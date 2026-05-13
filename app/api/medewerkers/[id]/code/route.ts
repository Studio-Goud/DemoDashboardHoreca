import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { maakRegistratieCode } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/medewerkers/[id]/code
 *
 * Genereert een 6-cijferige registratiecode voor handmatige uitdeling
 * (manager geeft 'm via WhatsApp/SMS/mondeling aan medewerker).
 * Geen mail-verzending.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const medewerkerId = Number(params.id);
    if (!Number.isFinite(medewerkerId)) {
      return NextResponse.json({ error: "Ongeldig id" }, { status: 400 });
    }

    const rows = await db.select({
      id: schema.medewerkers.id,
      email: schema.medewerkers.email,
      voornaam: schema.medewerkers.voornaam,
    })
      .from(schema.medewerkers)
      .where(eq(schema.medewerkers.id, medewerkerId));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Medewerker niet gevonden" }, { status: 404 });
    }
    const m = rows[0];
    if (!m.email || m.email.startsWith("geen-email-")) {
      return NextResponse.json({
        error: "Medewerker heeft geen geldig e-mailadres — vul dat eerst in",
      }, { status: 400 });
    }

    const { code, verloopt } = await maakRegistratieCode(medewerkerId);

    return NextResponse.json({
      ok: true,
      code,
      email: m.email,
      voornaam: m.voornaam,
      verlooptOp: verloopt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
