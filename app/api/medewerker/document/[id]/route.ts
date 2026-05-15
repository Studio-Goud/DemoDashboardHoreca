/**
 * DELETE /api/medewerker/document/[id]
 *   → verwijdert eigen document. Niet toegestaan als 'ie al goedgekeurd is.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sessie = await huidigeSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id ongeldig" }, { status: 400 });

  const [doc] = await db.select({
    medewerkerId: schema.medewerkerDocumenten.medewerkerId,
    goedgekeurd: schema.medewerkerDocumenten.goedgekeurd,
  })
    .from(schema.medewerkerDocumenten)
    .where(eq(schema.medewerkerDocumenten.id, id));

  if (!doc) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  if (doc.medewerkerId !== sessie.medewerkerId) {
    return NextResponse.json({ error: "geen toegang" }, { status: 403 });
  }
  if (doc.goedgekeurd) {
    return NextResponse.json({ error: "al goedgekeurd — neem contact op met eigenaar" }, { status: 409 });
  }

  await db.delete(schema.medewerkerDocumenten).where(and(
    eq(schema.medewerkerDocumenten.id, id),
    eq(schema.medewerkerDocumenten.medewerkerId, sessie.medewerkerId),
  ));
  return NextResponse.json({ ok: true });
}
