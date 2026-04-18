import { NextRequest, NextResponse } from "next/server";
import { dashboardAggregaten } from "@/lib/dashboard-cache";
import { notify, heeftNotifyConfig } from "@/lib/notify";
import type { Bedrijf } from "@/lib/sumup";
import { format, parseISO, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { nlDagKey } from "@/lib/tz";
import { komendeEvents } from "@/lib/feestdagen";
import { komendeCruises } from "@/lib/cruises";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BEDRIJVEN: Record<Bedrijf, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

function fmtEur(n: number) {
  return `€${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
}

async function bedrijfsSamenvatting(bedrijf: Bedrijf): Promise<string> {
  const agg = await dashboardAggregaten(bedrijf);
  const k = agg.kerncijfers;
  if (!k) return `${BEDRIJVEN[bedrijf]}: geen data beschikbaar.`;

  const gisteren = subDays(new Date(), 1);
  const gisterenKey = nlDagKey(gisteren);
  const gisterenDag = agg.dagOmzet.find((d) => d.datum === gisterenKey);
  const gisterenOmzet = gisterenDag?.omzet ?? 0;

  // Prognose voor vandaag (eerste item in prognose-array)
  const prognoseVandaag = agg.prognose[0];
  const vandaagVerwacht = prognoseVandaag?.verwacht ?? k.verwachtVandaag;
  const vandaagDruk = prognoseVandaag?.druk ?? "normaal";

  // Cruise vandaag?
  const vandaagKey = nlDagKey(new Date());
  const cruiseVandaag = agg.cruiseDagen.find((c) => c.datum === vandaagKey);

  // Feestdag vandaag?
  const feestVandaag = komendeEvents(1).find(
    (e) => nlDagKey(e.datum) === vandaagKey
  );

  const lijn = [
    `*${BEDRIJVEN[bedrijf]}*`,
    ``,
    `Gisteren: ${fmtEur(gisterenOmzet)}${gisterenDag ? ` (${gisterenDag.aantalTransacties} tx, gem. bon €${(gisterenOmzet / Math.max(gisterenDag.aantalTransacties, 1)).toFixed(2)})` : ""}`,
    `Deze week t/m nu: ${fmtEur(k.dezeWeek.omzet)} (${k.groei.tovVorigeWeek >= 0 ? "+" : ""}${k.groei.tovVorigeWeek}% vs vorige week)`,
    `Deze maand: ${fmtEur(k.dezeMaand.omzet)} (${k.groei.tovVorigeMaand >= 0 ? "+" : ""}${k.groei.tovVorigeMaand}% vs vorige maand)`,
    `YTD: ${fmtEur(k.ditJaar.omzet)} (${k.groei.tovVorigJaar >= 0 ? "+" : ""}${k.groei.tovVorigJaar}% vs vorig jaar)`,
    ``,
    `Vandaag verwacht: ${fmtEur(vandaagVerwacht)} — ${vandaagDruk}`,
  ];

  if (feestVandaag) {
    lijn.push(`🎉 Vandaag is ${feestVandaag.naam}`);
  }
  if (cruiseVandaag) {
    lijn.push(
      `🛳 Cruise: ${cruiseVandaag.cruises.length} schepen, ${cruiseVandaag.totaalPassagiers.toLocaleString("nl-NL")} passagiers`
    );
  }

  return lijn.join("\n");
}

export async function GET(req: NextRequest) {
  // Vercel cron auth: verifieer dat request van Vercel komt
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = heeftNotifyConfig();
  if (!cfg.webpush && !cfg.telegram && !cfg.email) {
    return NextResponse.json({
      status: "skipped",
      reden:
        "Geen notify-config. Zet push (VAPID+KV), Telegram, of e-mail op in Vercel env.",
    });
  }

  const alleSamenvattingen = await Promise.all([
    bedrijfsSamenvatting("bb"),
    bedrijfsSamenvatting("sl"),
    bedrijfsSamenvatting("kl"),
  ]);

  const vandaag = format(new Date(), "EEEE dd MMMM yyyy", { locale: nl });

  const tekst = [
    `Goedemorgen! Dagoverzicht voor ${vandaag}:`,
    ``,
    ...alleSamenvattingen.join("\n\n").split("\n"),
  ].join("\n");

  const resultaten = await notify({
    onderwerp: `Omzet dagoverzicht · ${format(new Date(), "dd-MM-yyyy")}`,
    tekstPlatte: tekst,
    url: "/bb",
    tag: "digest",
  });

  return NextResponse.json({
    status: "sent",
    timestamp: new Date().toISOString(),
    resultaten,
  });
}
