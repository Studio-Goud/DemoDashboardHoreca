import { NextRequest, NextResponse } from "next/server";
import { haalIngOp, haalFacturenOp, haalContantOp } from "@/lib/boekhouding-kv";
import { berekenMaand } from "@/lib/boekhouding";
import { dashboardAggregaten } from "@/lib/dashboard-cache";

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

  const [ingTxs, facturen, contant, agg] = await Promise.all([
    haalIngOp(bedrijf, jaar, [maand]),
    haalFacturenOp(bedrijf, jaar),
    haalContantOp(bedrijf, jaar),
    dashboardAggregaten(bedrijf).catch(() => null),
  ]);

  // Haal omzet op uit SumUp/Zettle aggregaten voor de juiste maand
  const maandOmzetItem = agg?.maandOmzet?.find(
    (m) => m.jaar === jaar && m.maand === maand
  );
  const omzetBruto = maandOmzetItem?.omzet ?? 0;
  // Horeca BTW 9%: omzet is incl. BTW, dus BTW = omzet - omzet/1.09
  const omzetBtwBetaald = Math.round((omzetBruto - omzetBruto / 1.09) * 100) / 100;

  const samenvatting = berekenMaand(jaar, maand, ingTxs, facturen, contant, omzetBruto, omzetBtwBetaald);

  return NextResponse.json({
    samenvatting,
    reviewItems: ingTxs.filter((t) => t.btwStatus === "review").length,
  });
}
