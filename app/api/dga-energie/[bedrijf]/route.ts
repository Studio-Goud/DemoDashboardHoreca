/**
 * GET /api/dga-energie/[bedrijf]?jaar=2026
 *   → { dga: DgaUittreksel, energie: EnergieUittreksel }
 *
 * Owner-only — DGA-onttrekkingen zijn privé-financiele info, energie mag
 * managers ook zien maar voor de eenvoud houden we beide samen owner-only.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { dgaUittreksel, energieUittreksel, type BedrijfSlug } from "@/lib/dga-energie";

export const dynamic = "force-dynamic";

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
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());
  const [dga, energie] = await Promise.all([
    dgaUittreksel(params.bedrijf as BedrijfSlug, jaar),
    energieUittreksel(params.bedrijf as BedrijfSlug, jaar),
  ]);
  return NextResponse.json({ dga, energie });
}
