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

  // Haal ook volgende maand op (eerste 3 dagen) voor salarisoverheveling
  const vMaand = maand === 12 ? 1 : maand + 1;
  const vJaar  = maand === 12 ? jaar + 1 : jaar;

  const [ingTxs, ingVolgend, facturen, contant, agg] = await Promise.all([
    haalIngOp(bedrijf, jaar, [maand]),
    haalIngOp(bedrijf, vJaar, [vMaand]),
    haalFacturenOp(bedrijf, jaar),
    haalContantOp(bedrijf, jaar),
    dashboardAggregaten(bedrijf).catch(() => null),
  ]);

  const alleIngTxs = [...ingTxs, ...ingVolgend];

  // Haal omzet op uit SumUp/Zettle aggregaten voor de juiste maand
  const maandOmzetItem = agg?.maandOmzet?.find(
    (m) => m.jaar === jaar && m.maand === maand
  );
  const omzetBruto = maandOmzetItem?.omzet ?? 0;
  // Horeca BTW 9%: omzet is incl. BTW, dus BTW = omzet - omzet/1.09
  const omzetBtwBetaald = Math.round((omzetBruto - omzetBruto / 1.09) * 100) / 100;

  const samenvatting = berekenMaand(jaar, maand, alleIngTxs, facturen, contant, omzetBruto, omzetBtwBetaald);

  return NextResponse.json({
    samenvatting,
    reviewItems: alleIngTxs.filter((t) => t.btwStatus === "review").length,
  });
}
