import { NextRequest, NextResponse } from "next/server";
import { haalFactuurPdfs, oneComConfig } from "@/lib/imap-facturen";
import { parseFactuurPdf } from "@/lib/factuur-ai";
import { slaFacturenOp } from "@/lib/boekhouding-kv";

export const maxDuration = 60;

const BEDRIJVEN = ["bb", "sl", "kl"] as const;
type BedrijfSlug = typeof BEDRIJVEN[number];

function getEmailConfig(bedrijf: BedrijfSlug) {
  const prefix = bedrijf.toUpperCase();
  const user = process.env[`EMAIL_USER_${prefix}`];
  const pass = process.env[`EMAIL_PASS_${prefix}`];
  if (!user || !pass) return null;
  return oneComConfig(user, pass);
}

// GET /api/cron/facturen-sync — dagelijkse sync via Vercel Cron (06:00)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Haal facturen op vanaf 1 april 2026
  const sindsDate = new Date("2026-04-01");
  const resultaten: Record<string, { verwerkt: number; fout?: string }> = {};

  for (const bedrijf of BEDRIJVEN) {
    const config = getEmailConfig(bedrijf);
    if (!config) {
      resultaten[bedrijf] = { verwerkt: 0, fout: "Email niet geconfigureerd" };
      continue;
    }
    try {
      const ruwe = await haalFactuurPdfs(config, sindsDate);
      if (ruwe.length === 0) {
        resultaten[bedrijf] = { verwerkt: 0 };
        continue;
      }
      const facturen = [];
      for (let i = 0; i < ruwe.length; i += 3) {
        const batch = ruwe.slice(i, i + 3);
        const parsed = await Promise.all(batch.map((r) => parseFactuurPdf(r)));
        facturen.push(...parsed);
      }
      await slaFacturenOp(bedrijf, facturen);
      resultaten[bedrijf] = { verwerkt: facturen.length };
    } catch (err) {
      resultaten[bedrijf] = {
        verwerkt: 0,
        fout: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({ ok: true, resultaten, tijdstip: new Date().toISOString() });
}
