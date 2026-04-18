import { NextRequest, NextResponse } from "next/server";
import { dashboardAggregaten } from "@/lib/dashboard-cache";
import { notify, heeftNotifyConfig } from "@/lib/notify";
import { getHoursNL, getDayNL } from "@/lib/tz";
import { OPENINGSUREN } from "@/lib/openingsuren";
import type { Bedrijf } from "@/lib/sumup";
import { fetchTransactions } from "@/lib/sumup";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BEDRIJVEN: Record<Bedrijf, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

// Alerts worden gestuurd als voortgang < 70% van schema-verwachting,
// maar max 1x per dag per bedrijf per drempel. We gebruiken een simpele
// in-memory flag per container (Vercel serverless heeft korte levensduur
// dus de drempel kan over verschillende instances opnieuw afvuren — dat
// is acceptabel voor deze use-case).
const laatsteAlert: Record<Bedrijf, string | null> = {
  bb: null,
  sl: null,
  kl: null,
};

function verwachtTotNu(curve: number[], nu: Date): number {
  if (curve.length !== 24) return 0;
  const uur = getHoursNL(nu);
  const min = nu.getMinutes() / 60;
  let som = 0;
  for (let i = 0; i < uur; i++) som += curve[i] ?? 0;
  som += (curve[uur] ?? 0) * min;
  return Math.round(som * 100) / 100;
}

async function checkBedrijf(bedrijf: Bedrijf, nu: Date): Promise<string | null> {
  const wd = getDayNL(nu);
  const uren = OPENINGSUREN[wd];
  if (!uren) return null;
  const u = getHoursNL(nu);
  // Alleen tijdens openingsuren (en pas na het eerste uur, zodat er iets
  // te vergelijken is — niks alerten om 10:15 als je net open bent)
  if (u < uren.open + 1 || u >= uren.close) return null;

  const agg = await dashboardAggregaten(bedrijf);
  const verwacht = verwachtTotNu(agg.weekdagCurve, nu);
  if (verwacht < 100) return null; // te weinig historie

  // Omzet vandaag — live ophalen zodat we niet wachten op cache
  let omzetVandaag = 0;
  try {
    const van = startOfDay(nu).toISOString();
    const txs = await fetchTransactions(bedrijf, {
      oldest_time: van,
      limit: 250,
    });
    omzetVandaag = txs.reduce((s, tx) => s + tx.amount, 0);
  } catch {
    return null;
  }

  const pct = (omzetVandaag / Math.max(verwacht, 1)) * 100;
  if (pct >= 70) return null;

  // Alleen 1x per dag per drempel
  const vandaag = nu.toISOString().slice(0, 10);
  const flagKey = `${vandaag}:${Math.floor(pct / 10)}`;
  if (laatsteAlert[bedrijf] === flagKey) return null;
  laatsteAlert[bedrijf] = flagKey;

  return (
    `⚠️ *${BEDRIJVEN[bedrijf]}* loopt achter op schema\n` +
    `Huidig: €${omzetVandaag.toFixed(0)} · verwacht nu: €${verwacht.toFixed(0)} (${pct.toFixed(0)}%)\n` +
    `Normaal op deze ${["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"][wd]} rond ${u}:00.`
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cfg = heeftNotifyConfig();
  if (!cfg.webpush && !cfg.telegram && !cfg.email) {
    return NextResponse.json({ status: "skipped", reden: "Geen notify-config" });
  }

  const nu = new Date();
  const berichten: string[] = [];
  for (const b of ["bb", "sl", "kl"] as const) {
    const msg = await checkBedrijf(b, nu);
    if (msg) berichten.push(msg);
  }

  if (berichten.length === 0) {
    return NextResponse.json({ status: "ok", alerts: 0 });
  }

  const resultaten = await notify({
    onderwerp: "Achter op schema",
    tekstPlatte: berichten.join("\n\n"),
    url: "/bb",
    tag: "schema-check",
  });

  return NextResponse.json({
    status: "sent",
    alerts: berichten.length,
    resultaten,
  });
}
