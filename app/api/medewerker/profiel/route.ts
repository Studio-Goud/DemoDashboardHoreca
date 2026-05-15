/**
 * Profiel (NAW + IBAN + BSN) van de ingelogde medewerker.
 *
 * GET  → huidige profiel-velden (BSN ge-redacteerd: alleen laatste 4 cijfers)
 * PUT  → bijwerken; markeert onboarding_voltooid=true als alle verplichte
 *        velden zijn ingevuld (geboortedatum + straat + huisnummer +
 *        postcode + woonplaats + iban + bsn)
 *
 * BSN wordt server-side AES-256-GCM versleuteld voor opslag (zie
 * lib/documenten.ts).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { ontsleutelTekst, versleutelTekst } from "@/lib/documenten";

export const dynamic = "force-dynamic";

function redacteerBsn(bsnEncrypted: string | null): string | null {
  if (!bsnEncrypted) return null;
  try {
    const plain = ontsleutelTekst(bsnEncrypted);
    return plain.length >= 4 ? `••••${plain.slice(-4)}` : "••••";
  } catch {
    return "••••";
  }
}

export async function GET() {
  const sessie = await huidigeSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const [row] = await db.select({
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
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));

  if (!row) return NextResponse.json({ error: "medewerker niet gevonden" }, { status: 404 });

  return NextResponse.json({
    voornaam: row.voornaam,
    achternaam: row.achternaam,
    email: row.email,
    telefoon: row.telefoon,
    geboortedatum: row.geboortedatum,
    straat: row.straat,
    huisnummer: row.huisnummer,
    postcode: row.postcode,
    woonplaats: row.woonplaats,
    iban: row.iban,
    bsnGemaskeerd: redacteerBsn(row.bsnVersleuteld),
    onboardingVoltooid: row.onboardingVoltooid,
  });
}

interface ProfielUpdate {
  voornaam?: string;
  achternaam?: string;
  telefoon?: string;
  geboortedatum?: string;
  straat?: string;
  huisnummer?: string;
  postcode?: string;
  woonplaats?: string;
  iban?: string;
  bsn?: string;
}

function normaliseerIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function isGeldigeNlIban(iban: string): boolean {
  // Format NLkk BANK xxxx xxxx xx — totaal 18 tekens. Geen mod-97 check;
  // owner verifieert sowieso handmatig met de bankpas-foto.
  return /^NL\d{2}[A-Z]{4}\d{10}$/.test(iban);
}

function isGeldigBsn(bsn: string): boolean {
  if (!/^\d{8,9}$/.test(bsn)) return false;
  const digits = bsn.padStart(9, "0").split("").map(Number);
  // BSN 11-proef: som(d * factor) % 11 == 0, factors 9,8,7,6,5,4,3,2,-1
  const factors = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  const som = digits.reduce((s, d, i) => s + d * factors[i], 0);
  return som % 11 === 0;
}

export async function PUT(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ProfielUpdate;

  const updates: Record<string, unknown> = {};
  if (body.voornaam !== undefined) updates.voornaam = body.voornaam.trim();
  if (body.achternaam !== undefined) updates.achternaam = body.achternaam.trim();
  if (body.telefoon !== undefined) updates.telefoon = body.telefoon.trim() || null;
  if (body.geboortedatum !== undefined) updates.geboortedatum = body.geboortedatum || null;
  if (body.straat !== undefined) updates.straat = body.straat.trim() || null;
  if (body.huisnummer !== undefined) updates.huisnummer = body.huisnummer.trim() || null;
  if (body.postcode !== undefined) updates.postcode = body.postcode.trim().toUpperCase() || null;
  if (body.woonplaats !== undefined) updates.woonplaats = body.woonplaats.trim() || null;

  if (body.iban !== undefined) {
    const iban = normaliseerIban(body.iban);
    if (iban && !isGeldigeNlIban(iban)) {
      return NextResponse.json({ error: "IBAN-formaat klopt niet (verwacht NL..)" }, { status: 400 });
    }
    updates.iban = iban || null;
  }

  if (body.bsn !== undefined) {
    const bsn = body.bsn.replace(/\s+/g, "");
    if (bsn && !isGeldigBsn(bsn)) {
      return NextResponse.json({ error: "BSN ongeldig (klopt niet met 11-proef)" }, { status: 400 });
    }
    updates.bsnVersleuteld = bsn ? versleutelTekst(bsn) : null;
  }

  // Onboarding-voltooid markering: alle verplichte velden ingevuld?
  // Eerst current row ophalen om te kijken wat er nog ontbreekt na deze update.
  const [huidig] = await db.select({
    geboortedatum: schema.medewerkers.geboortedatum,
    straat: schema.medewerkers.straat,
    huisnummer: schema.medewerkers.huisnummer,
    postcode: schema.medewerkers.postcode,
    woonplaats: schema.medewerkers.woonplaats,
    iban: schema.medewerkers.iban,
    bsnVersleuteld: schema.medewerkers.bsnVersleuteld,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));

  if (!huidig) return NextResponse.json({ error: "medewerker niet gevonden" }, { status: 404 });

  const samengevoegd = { ...huidig, ...updates };

  // Documenten-check: 3 verplichte types moeten allemaal aanwezig zijn.
  const aanwezigeTypes = await db.select({
    type: schema.medewerkerDocumenten.type,
  })
    .from(schema.medewerkerDocumenten)
    .where(eq(schema.medewerkerDocumenten.medewerkerId, sessie.medewerkerId));
  const types = new Set(aanwezigeTypes.map((r) => r.type));
  const documentenCompleet = types.has("id-voor") && types.has("id-achter") && types.has("bankpas");

  const compleet = !!(
    samengevoegd.geboortedatum &&
    samengevoegd.straat &&
    samengevoegd.huisnummer &&
    samengevoegd.postcode &&
    samengevoegd.woonplaats &&
    samengevoegd.iban &&
    samengevoegd.bsnVersleuteld &&
    documentenCompleet
  );
  updates.onboardingVoltooid = compleet;
  updates.updatedAt = new Date();

  await db.update(schema.medewerkers).set(updates).where(eq(schema.medewerkers.id, sessie.medewerkerId));
  return NextResponse.json({ ok: true, onboardingVoltooid: compleet });
}
