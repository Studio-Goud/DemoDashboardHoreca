/**
 * GET /api/medewerker/document/[id]/inhoud
 *   → streamt de gedecodeerde foto-bytes
 *
 * Toegestaan voor:
 * - De medewerker zelf (eigen foto's bekijken)
 * - Owners (via admin-cookie, voor de loonadministratie-review)
 *
 * Managers krijgen 403 — ID-foto's en bankpas-foto's zijn privacy-
 * gevoelig en alleen owners hebben zakelijk reden ze in te zien.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { ontsleutelBestand } from "@/lib/documenten";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id ongeldig" }, { status: 400 });

  const [doc] = await db.select({
    medewerkerId: schema.medewerkerDocumenten.medewerkerId,
    mimetype: schema.medewerkerDocumenten.mimetype,
    bestandsnaam: schema.medewerkerDocumenten.bestandsnaam,
    iv: schema.medewerkerDocumenten.iv,
    authtag: schema.medewerkerDocumenten.authtag,
    ciphertext: schema.medewerkerDocumenten.ciphertext,
  }).from(schema.medewerkerDocumenten).where(eq(schema.medewerkerDocumenten.id, id));

  if (!doc) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });

  // Autorisatie: eigen medewerker OF owner-sessie.
  const adminSessie = huidigeAdminSessie();
  const isOwner = adminSessie?.rol === "owner";
  if (!isOwner) {
    const med = await huidigeSessie();
    if (!med || med.medewerkerId !== doc.medewerkerId) {
      return NextResponse.json({ error: "geen toegang" }, { status: 403 });
    }
  }

  let plain: Buffer;
  try {
    plain = ontsleutelBestand({ iv: doc.iv, authtag: doc.authtag, ciphertext: doc.ciphertext });
  } catch {
    return NextResponse.json({ error: "ontsleutelen mislukt — key wijziging?" }, { status: 500 });
  }

  // Buffer → Uint8Array zodat NextResponse 'm als BodyInit accepteert
  const body = new Uint8Array(plain);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": doc.mimetype,
      "Content-Length": String(plain.length),
      "Content-Disposition": `inline; filename="${doc.bestandsnaam ?? "document"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
