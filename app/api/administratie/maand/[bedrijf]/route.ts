import { NextRequest, NextResponse } from "next/server";
import { haalIngOp, haalFacturenOp, haalContantOp } from "@/lib/boekhouding-kv";
import { berekenMaand } from "@/lib/boekhouding";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

function checkBedrijf(b: string): BedrijfSlug | null {
  return GELDIGE_BEDRIJVEN.has(b as BedrijfSlug) ? (b as BedrijfSlug) : null;
}

// GET /api/administratie/maand/[bedrijf]?jaar=2026&maand=3
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const nu = new Date();
  const jaar = Number(searchParams.get("jaar") ?? nu.getFullYear());
  const maand = Number(searchParams.get("maand") ?? nu.getMonth() + 1);

  const [ingTxs, facturen, contant] = await Promise.all([
    haalIngOp(bedrijf, jaar, [maand]),
    haalFacturenOp(bedrijf, jaar),
    haalContantOp(bedrijf, jaar),
  ]);

  const samenvatting = berekenMaand(jaar, maand, ingTxs, facturen, contant);

  return NextResponse.json({
    samenvatting,
    reviewItems: ingTxs.filter((t) => t.btwStatus === "review").length,
  });
}
