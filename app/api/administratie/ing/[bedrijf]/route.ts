import { NextRequest, NextResponse } from "next/server";
import { parseIngExcel, parseIngCsv } from "@/lib/ing";
import { slaIngOp, haalIngOp, updateIngTransactie } from "@/lib/boekhouding-kv";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

function checkBedrijf(b: string): BedrijfSlug | null {
  return GELDIGE_BEDRIJVEN.has(b as BedrijfSlug) ? (b as BedrijfSlug) : null;
}

// POST /api/administratie/ing/[bedrijf] — upload ING Excel of CSV
export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const formData = await req.formData();
  const bestand = formData.get("bestand") as File | null;
  if (!bestand) return NextResponse.json({ error: "Geen bestand" }, { status: 400 });

  const buffer = Buffer.from(await bestand.arrayBuffer());
  const naam = bestand.name.toLowerCase();

  let txs;
  if (naam.endsWith(".xlsx") || naam.endsWith(".xls")) {
    txs = parseIngExcel(buffer);
  } else if (naam.endsWith(".csv") || naam.endsWith(".txt")) {
    txs = parseIngCsv(buffer.toString("utf-8"));
  } else {
    return NextResponse.json({ error: "Gebruik .xlsx, .xls of .csv" }, { status: 400 });
  }

  if (txs.length === 0) {
    return NextResponse.json({ error: "Geen transacties gevonden in bestand" }, { status: 422 });
  }

  await slaIngOp(bedrijf, txs);

  const reviewCount = txs.filter((t) => t.btwStatus === "review").length;
  return NextResponse.json({
    opgeslagen: txs.length,
    reviewNodig: reviewCount,
    bericht: `${txs.length} transacties verwerkt, ${reviewCount} vereisen handmatige BTW-controle.`,
  });
}

// GET /api/administratie/ing/[bedrijf]?jaar=2026&maand=1
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());
  const maandParam = searchParams.get("maand");
  const maanden = maandParam ? [Number(maandParam)] : undefined;

  const txs = await haalIngOp(bedrijf, jaar, maanden);
  return NextResponse.json({ transacties: txs, totaal: txs.length });
}

// PATCH /api/administratie/ing/[bedrijf] — handmatig BTW corrigeren
export async function PATCH(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const body = await req.json() as {
    id: string; jaar: number; maand: number;
    btw21?: number; btw9?: number; categorie?: string;
  };

  await updateIngTransactie(bedrijf, body.jaar, body.maand, body.id, {
    btw21: body.btw21,
    btw9: body.btw9,
    categorie: body.categorie,
    btwStatus: "handmatig",
  });

  return NextResponse.json({ ok: true });
}
