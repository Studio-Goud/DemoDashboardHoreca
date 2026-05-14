/**
 * PATCH /api/gedeelde-voorraad/producten/[id]  → bewerk (owner only)
 * Soft-delete via PATCH { actief: false } ipv echte DELETE — afnames blijven
 * gekoppeld voor de maand-afrekening.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { bewerkProduct } from "@/lib/gedeelde-voorraad";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag producten bewerken" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ongeldig id" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as {
    naam?: string; eenheid?: string; prijsPerEenheid?: number | null; categorie?: string | null; actief?: boolean;
  };
  await bewerkProduct(id, body);
  return NextResponse.json({ ok: true });
}
