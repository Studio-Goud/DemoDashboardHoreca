/**
 * GET /api/admin/medewerker-documenten?medewerkerId=…
 *   → lijst van documenten + medewerker-info voor de review
 *
 * Zonder medewerkerId: alle medewerkers met hun onboarding-status +
 * aantal docs. Voor het overzicht-paneel.
 * Met medewerkerId: gedetailleerde lijst per type voor 1 medewerker
 * + ontsleutelde BSN (alleen voor owners).
 *
 * Owner-only — managers krijgen 403.
 */
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { ontsleutelTekst } from "@/lib/documenten";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }

  const url = new URL(req.url);
  const medewerkerIdParam = url.searchParams.get("medewerkerId");

  if (medewerkerIdParam) {
    const id = Number(medewerkerIdParam);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "id ongeldig" }, { status: 400 });

    const [m] = await db.select({
      id: schema.medewerkers.id,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
      email: schema.medewerkers.email,
      telefoon: schema.medewerkers.telefoon,
      geboortedatum: schema.medewerkers.geboortedatum,
      straat: schema.medewerkers.straat,
      huisnummer: schema.medewerkers.huisnummer,
      postcode: schema.medewerkers.postcode,
      woonplaats: schema.medewerkers.woonplaats,
      iban: schema.medewerkers.iban,
      bsnVersleuteld: schema.medewerkers.bsnVersleuteld,
      onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
      goedgekeurd: schema.medewerkers.goedgekeurd,
      goedgekeurdOp: schema.medewerkers.goedgekeurdOp,
      goedgekeurdDoor: schema.medewerkers.goedgekeurdDoor,
    }).from(schema.medewerkers).where(eq(schema.medewerkers.id, id));

    if (!m) return NextResponse.json({ error: "medewerker niet gevonden" }, { status: 404 });

    const docs = await db.select({
      id: schema.medewerkerDocumenten.id,
      type: schema.medewerkerDocumenten.type,
      mimetype: schema.medewerkerDocumenten.mimetype,
      bestandsnaam: schema.medewerkerDocumenten.bestandsnaam,
      grootteBytes: schema.medewerkerDocumenten.grootteBytes,
      geuploadOp: schema.medewerkerDocumenten.geuploadOp,
      goedgekeurd: schema.medewerkerDocumenten.goedgekeurd,
      goedgekeurdDoor: schema.medewerkerDocumenten.goedgekeurdDoor,
      goedgekeurdOp: schema.medewerkerDocumenten.goedgekeurdOp,
    }).from(schema.medewerkerDocumenten).where(eq(schema.medewerkerDocumenten.medewerkerId, id));

    let bsn: string | null = null;
    if (m.bsnVersleuteld) {
      try { bsn = ontsleutelTekst(m.bsnVersleuteld); } catch { bsn = "(decryptie-fout)"; }
      // AVG art.30: trackbaar wie wanneer BSN heeft ingezien.
      await logAudit(
        "medewerker_bsn",
        m.id,
        "decrypt",
        null,
        { door: sessie.naam },
        { doorRol: sessie.rol, reden: "BSN gelezen in review-paneel" },
      );
    }

    return NextResponse.json({
      medewerker: {
        id: m.id,
        voornaam: m.voornaam,
        achternaam: m.achternaam,
        email: m.email,
        telefoon: m.telefoon,
        geboortedatum: m.geboortedatum,
        straat: m.straat,
        huisnummer: m.huisnummer,
        postcode: m.postcode,
        woonplaats: m.woonplaats,
        iban: m.iban,
        bsn,
        onboardingVoltooid: m.onboardingVoltooid,
        goedgekeurd: m.goedgekeurd,
        goedgekeurdOp: m.goedgekeurdOp,
        goedgekeurdDoor: m.goedgekeurdDoor,
      },
      documenten: docs,
    });
  }

  // Overzicht: alle medewerkers + counts.
  const rows = await db.select({
    id: schema.medewerkers.id,
    voornaam: schema.medewerkers.voornaam,
    achternaam: schema.medewerkers.achternaam,
    email: schema.medewerkers.email,
    onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
    goedgekeurd: schema.medewerkers.goedgekeurd,
    aantalDocs: sql<number>`(
      select count(*)::int from ${schema.medewerkerDocumenten}
      where ${schema.medewerkerDocumenten.medewerkerId} = ${schema.medewerkers.id}
    )`.as("aantal_docs"),
    aantalGoedgekeurd: sql<number>`(
      select count(*)::int from ${schema.medewerkerDocumenten}
      where ${schema.medewerkerDocumenten.medewerkerId} = ${schema.medewerkers.id}
        and ${schema.medewerkerDocumenten.goedgekeurd} = true
    )`.as("aantal_goedgekeurd"),
  })
    .from(schema.medewerkers)
    .where(eq(schema.medewerkers.actief, true));

  return NextResponse.json({ medewerkers: rows });
}
