import { NextRequest, NextResponse } from "next/server";
import { haalContantOp, voegContantToe, verwijderContant } from "@/lib/boekhouding-kv";
import type { ContantRegel } from "@/lib/boekhouding";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

function checkBedrijf(b: string): BedrijfSlug | null {
  return GELDIGE_BEDRIJVEN.has(b as BedrijfSlug) ? (b as BedrijfSlug) : null;
}

function berekenBtw(bedrag: number, tarief: 0 | 9 | 21) {
  if (tarief === 21) return { btw21: Math.round((bedrag - bedrag / 1.21) * 100) / 100, btw9: 0 };
  if (tarief === 9)  return { btw21: 0, btw9: Math.round((bedrag - bedrag / 1.09) * 100) / 100 };
  return { btw21: 0, btw9: 0 };
}

// GET /api/administratie/contant/[bedrijf]?jaar=2026
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());

  const regels = await haalContantOp(bedrijf, jaar);
  return NextResponse.json({ regels });
}

// POST /api/administratie/contant/[bedrijf]
export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const body = await req.json() as {
    datum: string;
    omschrijving: string;
    bedrag: number;
    tarief?: 0 | 9 | 21;
    btw21?: number;
    btw9?: number;
    type: "inkomst" | "uitgave";
  };

  if (!body.datum || !body.omschrijving || !body.bedrag) {
    return NextResponse.json({ error: "datum, omschrijving en bedrag zijn verplicht" }, { status: 400 });
  }

  // Gebruik directe BTW bedragen als opgegeven, anders bereken via tarief
  const { btw21, btw9 } = (body.btw21 !== undefined || body.btw9 !== undefined)
    ? { btw21: body.btw21 ?? 0, btw9: body.btw9 ?? 0 }
    : berekenBtw(Math.abs(body.bedrag), body.tarief ?? 9);
  const id = `contant-${body.datum}-${Date.now()}`;

  const regel: ContantRegel = {
    id,
    datum: body.datum,
    omschrijving: body.omschrijving,
    bedrag: Math.abs(body.bedrag),
    btw21,
    btw9,
    type: body.type ?? "uitgave",
  };

  await voegContantToe(bedrijf, regel);
  return NextResponse.json({ ok: true, id });
}

// DELETE /api/administratie/contant/[bedrijf]?jaar=2026&id=xxx
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

  await verwijderContant(bedrijf, jaar, id);
  return NextResponse.json({ ok: true });
}
