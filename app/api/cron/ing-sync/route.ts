import { NextRequest, NextResponse } from "next/server";
import { haalVerbinding, getGeldigToken, updateLaatsteSync, haalLaatsteSync } from "@/lib/gocardless-kv";
import { haalTransacties } from "@/lib/gocardless";
import { vanGcTransactie } from "@/lib/ing";
import { slaIngOp } from "@/lib/boekhouding-kv";

const BEDRIJVEN = ["bb", "sl", "kl"] as const;
type BedrijfSlug = typeof BEDRIJVEN[number];

// GET /api/cron/ing-sync — dagelijkse automatische sync (aangeroepen door Vercel Cron)
export async function GET(req: NextRequest) {
  // Vercel cron authenticatie
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultaten: Record<string, unknown> = {};

  for (const bedrijf of BEDRIJVEN) {
    const verbinding = await haalVerbinding(bedrijf);
    if (!verbinding || verbinding.status !== "linked") {
      resultaten[bedrijf] = { overgeslagen: true, reden: verbinding?.status ?? "niet_verbonden" };
      continue;
    }

    try {
      const laatseSyncRaw = await haalLaatsteSync(bedrijf);
      const vanDate = laatseSyncRaw
        ? new Date(new Date(laatseSyncRaw).getTime() - 2 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const vanStr = vanDate.toISOString().slice(0, 10);
      const totStr = new Date().toISOString().slice(0, 10);

      const token = await getGeldigToken();
      let totaalNieuw = 0;

      for (const account of verbinding.accounts) {
        const { booked } = await haalTransacties(token, account.id, vanStr, totStr);
        const ingTxs = booked
          .map((gc) => vanGcTransactie(gc))
          .filter((tx): tx is NonNullable<typeof tx> => tx !== null);

        if (ingTxs.length > 0) {
          await slaIngOp(bedrijf as BedrijfSlug, ingTxs);
          totaalNieuw += ingTxs.length;
        }
      }

      await updateLaatsteSync(bedrijf as BedrijfSlug);
      resultaten[bedrijf] = { gesynchroniseerd: totaalNieuw, vanDate: vanStr, totDate: totStr };
    } catch (err) {
      resultaten[bedrijf] = { fout: err instanceof Error ? err.message : "Onbekend" };
    }
  }

  return NextResponse.json({ ok: true, resultaten, tijdstip: new Date().toISOString() });
}
