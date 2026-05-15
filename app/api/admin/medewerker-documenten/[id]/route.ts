/**
 * Document-acties voor owner-review.
 *
 * PATCH /api/admin/medewerker-documenten/[id]
 *   body: { goedgekeurd: boolean }
 *   → markeert het document als wel/niet goedgekeurd
 *
 * DELETE /api/admin/medewerker-documenten/[id]
 *   → owner verwijdert document (bv. afgekeurd → medewerker mag opnieuw)
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie || sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id ongeldig" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { goedgekeurd?: boolean };
  if (typeof body.goedgekeurd !== "boolean") {
    return NextResponse.json({ error: "goedgekeurd boolean vereist" }, { status: 400 });
  }

  await db.update(schema.medewerkerDocumenten).set({
    goedgekeurd: body.goedgekeurd,
    goedgekeurdDoor: body.goedgekeurd ? sessie.naam : null,
    goedgekeurdOp: body.goedgekeurd ? new Date() : null,
  }).where(eq(schema.medewerkerDocumenten.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie || sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id ongeldig" }, { status: 400 });

  await db.delete(schema.medewerkerDocumenten).where(eq(schema.medewerkerDocumenten.id, id));
  return NextResponse.json({ ok: true });
}
