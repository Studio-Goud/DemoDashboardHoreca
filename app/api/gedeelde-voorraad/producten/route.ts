/**
 * GET  /api/gedeelde-voorraad/producten  → lijst (manager + owner)
 * POST /api/gedeelde-voorraad/producten  → nieuw product (owner only)
 *
 * Prijs is in beide zichtbaar; managers hebben hem nodig om te zien wat ze
 * "kosten" als ze iets pakken, maar bewerken mag alleen owner.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { listProducten, voegProductToe } from "@/lib/gedeelde-voorraad";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  await runAllePendingMigraties().catch(() => null);
  const producten = await listProducten();
  return NextResponse.json(producten);
}

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag producten beheren" }, { status: 403 });
  }
  await runAllePendingMigraties().catch(() => null);
  const body = (await req.json().catch(() => ({}))) as {
    naam?: string; eenheid?: string; prijsPerEenheid?: number | null; categorie?: string | null;
  };
  if (!body.naam?.trim()) {
    return NextResponse.json({ error: "naam verplicht" }, { status: 400 });
  }
  const id = await voegProductToe(
    body.naam,
    body.eenheid ?? "stuk",
    body.prijsPerEenheid ?? null,
    body.categorie ?? null,
  );
  return NextResponse.json({ id });
}
