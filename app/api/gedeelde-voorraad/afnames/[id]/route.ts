/**
 * DELETE /api/gedeelde-voorraad/afnames/[id]  → undo (owner of manager).
 * Manager mag fouten direct rechtzetten; owner mag altijd.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { verwijderAfname } from "@/lib/gedeelde-voorraad";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ongeldig id" }, { status: 400 });
  await verwijderAfname(id);
  return NextResponse.json({ ok: true });
}
