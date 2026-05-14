/**
 * GET  /api/gedeelde-voorraad/afnames?voor=bb  → recente afnames (manager/owner)
 * POST /api/gedeelde-voorraad/afnames           → log een afname (manager/owner)
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { recenteAfnames, logAfname, type BedrijfSlug } from "@/lib/gedeelde-voorraad";

export const dynamic = "force-dynamic";

const GELDIGE: BedrijfSlug[] = ["bb", "sl", "kl"];

export async function GET(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const voor = (searchParams.get("voor") ?? "") as BedrijfSlug;
  if (!GELDIGE.includes(voor)) return NextResponse.json({ error: "voor=bedrijf vereist" }, { status: 400 });
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 50));
  const afnames = await recenteAfnames(voor, limit);
  return NextResponse.json(afnames);
}

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager mag loggen" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    productId?: number; voorBedrijf?: string; aantal?: number; datum?: string;
    doorMedewerkerId?: number | null; notitie?: string | null;
  };
  if (!body.productId || !body.voorBedrijf || !body.aantal || !body.datum) {
    return NextResponse.json({ error: "productId, voorBedrijf, aantal en datum verplicht" }, { status: 400 });
  }
  if (!GELDIGE.includes(body.voorBedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  if (body.aantal <= 0) {
    return NextResponse.json({ error: "aantal moet > 0 zijn" }, { status: 400 });
  }
  const id = await logAfname(
    body.productId,
    body.voorBedrijf as BedrijfSlug,
    body.aantal,
    body.datum,
    body.doorMedewerkerId ?? null,
    body.notitie ?? null,
  );
  return NextResponse.json({ id });
}
