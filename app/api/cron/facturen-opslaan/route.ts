import { NextRequest, NextResponse } from "next/server";
import { slaFacturenOp } from "@/lib/boekhouding-kv";
import type { Factuur } from "@/lib/factuur-ai";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

// POST /api/cron/facturen-opslaan
// Ontvang geparseeerde facturen van GitHub Actions en sla ze op in KV
export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.bedrijf || !Array.isArray(body.facturen)) {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const bedrijf = body.bedrijf as string;
  if (!GELDIGE_BEDRIJVEN.has(bedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }

  const facturen = body.facturen as Factuur[];
  await slaFacturenOp(bedrijf as BedrijfSlug, facturen);

  return NextResponse.json({ ok: true, opgeslagen: facturen.length });
}
