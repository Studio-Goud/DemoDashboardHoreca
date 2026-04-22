import { NextRequest, NextResponse } from "next/server";
import { getGeldigToken, haalVerbinding, updateLaatsteSync, haalLaatsteSync } from "@/lib/gocardless-kv";
import { haalTransacties } from "@/lib/gocardless";
import { vanGcTransactie } from "@/lib/ing";
import { slaIngOp } from "@/lib/boekhouding-kv";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

// POST /api/administratie/ing-sync/[bedrijf]
// Haalt nieuwe transacties op via GoCardless en slaat ze op
export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as BedrijfSlug;
  if (!GELDIGE_BEDRIJVEN.has(bedrijf)) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }

  const verbinding = await haalVerbinding(bedrijf);
  if (!verbinding) {
    return NextResponse.json({ error: "Nog niet verbonden met ING. Klik op 'Verbind ING'." }, { status: 400 });
  }
  if (verbinding.status === "expired") {
    return NextResponse.json({ error: "ING verbinding verlopen. Opnieuw verbinden." }, { status: 400 });
  }

  // Bepaal sync venster: vanaf laatste sync of 90 dagen terug
  const laatseSyncRaw = await haalLaatsteSync(bedrijf);
  const vanDate = laatseSyncRaw
    ? new Date(new Date(laatseSyncRaw).getTime() - 2 * 24 * 60 * 60 * 1000) // 2 dagen overlap
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const totDate = new Date();
  const vanStr = vanDate.toISOString().slice(0, 10);
  const totStr = totDate.toISOString().slice(0, 10);

  const token = await getGeldigToken();
  const alleTxs = [];
  let totaalNieuw = 0;

  for (const account of verbinding.accounts) {
    const { booked } = await haalTransacties(token, account.id, vanStr, totStr);
    const ingTxs = booked
      .map((gc) => vanGcTransactie(gc))
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null);

    if (ingTxs.length > 0) {
      await slaIngOp(bedrijf, ingTxs);
      totaalNieuw += ingTxs.length;
      alleTxs.push(...ingTxs);
    }
  }

  await updateLaatsteSync(bedrijf);

  const reviewCount = alleTxs.filter((t) => t.btwStatus === "review").length;

  return NextResponse.json({
    gesynchroniseerd: totaalNieuw,
    reviewNodig: reviewCount,
    vanDate: vanStr,
    totDate: totStr,
    bericht: `${totaalNieuw} transacties opgehaald (${vanStr} t/m ${totStr}), ${reviewCount} vereisen BTW-controle.`,
  });
}

// GET /api/administratie/ing-sync/[bedrijf] — status check
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as BedrijfSlug;
  if (!GELDIGE_BEDRIJVEN.has(bedrijf)) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }

  const [verbinding, laatsteSync] = await Promise.all([
    haalVerbinding(bedrijf),
    haalLaatsteSync(bedrijf),
  ]);

  return NextResponse.json({
    verbonden: verbinding?.status === "linked",
    verbindingStatus: verbinding?.status ?? "niet_verbonden",
    accounts: verbinding?.accounts ?? [],
    verbondenOp: verbinding?.verbondenOp ?? null,
    verlooptOp: verbinding?.verlooptOp ?? null,
    laatsteSync,
  });
}
