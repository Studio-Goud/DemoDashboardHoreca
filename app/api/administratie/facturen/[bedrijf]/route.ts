import { NextRequest, NextResponse } from "next/server";
import { haalFactuurPdfs, oneComConfig } from "@/lib/imap-facturen";
import { parseFactuurPdf } from "@/lib/factuur-ai";
import { slaFacturenOp, haalFacturenOp, verwijderFactuur } from "@/lib/boekhouding-kv";

export const maxDuration = 60;

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

function checkBedrijf(b: string): BedrijfSlug | null {
  return GELDIGE_BEDRIJVEN.has(b as BedrijfSlug) ? (b as BedrijfSlug) : null;
}

function getEmailConfig(bedrijf: BedrijfSlug) {
  const prefix = bedrijf.toUpperCase();
  const user = process.env[`EMAIL_USER_${prefix}`];
  const pass = process.env[`EMAIL_PASS_${prefix}`];
  if (!user || !pass) return null;
  return oneComConfig(user, pass);
}

// POST /api/administratie/facturen/[bedrijf] — sync email bijlagen
export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const config = getEmailConfig(bedrijf);
  if (!config) {
    return NextResponse.json({
      error: `Email niet geconfigureerd. Stel EMAIL_USER_${bedrijf.toUpperCase()} en EMAIL_PASS_${bedrijf.toUpperCase()} in als Vercel environment variable.`,
    }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { dagenTerug?: number; sindsdatum?: string };

  let sindsDate: Date;
  if (body.sindsdatum) {
    sindsDate = new Date(body.sindsdatum);
  } else if (body.dagenTerug) {
    sindsDate = new Date();
    sindsDate.setDate(sindsDate.getDate() - Math.min(body.dagenTerug, 365));
  } else {
    // Standaard: Q2 2026 (Q1 is al ingediend)
    sindsDate = new Date("2026-04-01");
  }

  try {
    const ruwe = await haalFactuurPdfs(config, sindsDate);
    if (ruwe.length === 0) {
      return NextResponse.json({ verwerkt: 0, bericht: "Geen nieuwe PDF-facturen gevonden." });
    }

    // Parseer alle PDFs serieel in batches van 5
    const facturen = [];
    for (let i = 0; i < ruwe.length; i += 5) {
      const batch = ruwe.slice(i, i + 5);
      const resultaten = await Promise.all(batch.map((r) => parseFactuurPdf(r)));
      facturen.push(...resultaten);
    }

    await slaFacturenOp(bedrijf, facturen);

    const reviewCount = facturen.filter((f) => f.status === "review").length;
    return NextResponse.json({
      verwerkt: facturen.length,
      reviewNodig: reviewCount,
      bericht: `${facturen.length} facturen verwerkt, ${reviewCount} vereisen controle.`,
    });
  } catch (err) {
    const bericht = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Email sync mislukt: ${bericht}` }, { status: 500 });
  }
}

// GET /api/administratie/facturen/[bedrijf]?jaar=2026
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());

  const facturen = await haalFacturenOp(bedrijf, jaar);
  return NextResponse.json({ facturen, totaal: facturen.length });
}

// DELETE /api/administratie/facturen/[bedrijf]?jaar=2026&id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar"));
  const id = searchParams.get("id");
  if (!jaar || !id) return NextResponse.json({ error: "jaar en id verplicht" }, { status: 400 });

  await verwijderFactuur(bedrijf, jaar, id);
  return NextResponse.json({ ok: true });
}
