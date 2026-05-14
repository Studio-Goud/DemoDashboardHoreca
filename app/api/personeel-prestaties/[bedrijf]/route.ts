/**
 * GET /api/personeel-prestaties/[bedrijf]?jaar=2026&maand=5
 *   → PrestatieRapport
 *
 * Owner-only — koppelt namen aan omzet. Manager kan niet (per-persoon
 * prestaties zijn privé voor functioneringsgesprekken).
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { prestatiesPerMaand, type BedrijfSlug } from "@/lib/personeel-prestaties";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GELDIGE = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

export async function GET(req: Request, { params }: { params: { bedrijf: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }
  if (!GELDIGE.has(params.bedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const nu = new Date();
  const jaar = Number(searchParams.get("jaar") ?? nu.getFullYear());
  const maand = Number(searchParams.get("maand") ?? nu.getMonth() + 1);
  if (!Number.isFinite(jaar) || !Number.isFinite(maand) || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "jaar/maand ongeldig" }, { status: 400 });
  }
  const rapport = await prestatiesPerMaand(params.bedrijf as BedrijfSlug, jaar, maand);
  return NextResponse.json(rapport);
}
