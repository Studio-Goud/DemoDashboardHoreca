/**
 * Eenmalige seed van een test-medewerker met PIN 1111 voor smoke-testing.
 *
 * POST /api/admin/seed-test-medewerker (owner-only)
 *   → { ok, id, email, pin: "1111" }
 *
 * Maakt of update een medewerker met email "test@markthal.local",
 * volledig onboarded en goedgekeurd, gekoppeld aan alle 3 vestigingen.
 * Idempotent — meermaals aanroepen reset de PIN naar 1111 en zet alle
 * onboarding-velden terug op compleet.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { hashPin } from "@/lib/auth";
import { versleutelTekst } from "@/lib/documenten";

export const dynamic = "force-dynamic";

const TEST_EMAIL = "test@markthal.local";
const TEST_PIN = "1111";

export async function POST() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }

  const pinHash = await hashPin(TEST_PIN);
  let bsnEnc: string | null = null;
  try { bsnEnc = versleutelTekst("123456782"); } catch { /* DOCUMENTEN_ENCRYPTIE_KEY niet gezet */ }

  // Departments ophalen — koppelen aan alle drie
  const depts = await db.select({ id: schema.departments.id, slug: schema.departments.slug })
    .from(schema.departments);
  const bb = depts.find((d) => d.slug === "bb");

  // Bestaand of nieuw?
  const [bestaand] = await db.select({ id: schema.medewerkers.id })
    .from(schema.medewerkers)
    .where(eq(schema.medewerkers.email, TEST_EMAIL));

  const basis = {
    voornaam: "Test",
    achternaam: "Medewerker",
    email: TEST_EMAIL,
    telefoon: "0612345678",
    startdatum: "2024-01-01",
    einddatum: null,
    uurloon: "14.50",
    vakantiegeldPct: "8.33",
    vakantieUrenPct: "8.00",
    pinHash,
    geboortedatum: "1995-06-15",
    straat: "Teststraat",
    huisnummer: "42",
    postcode: "1234AB",
    woonplaats: "Rotterdam",
    iban: "NL91ABNA0417164300",
    bsnVersleuteld: bsnEnc,
    onboardingVoltooid: true,
    goedgekeurd: true,
    goedgekeurdOp: new Date(),
    goedgekeurdDoor: sessie.naam,
    hoofdDepartmentId: bb?.id ?? null,
  };

  let medewerkerId: number;
  if (bestaand) {
    await db.update(schema.medewerkers).set(basis).where(eq(schema.medewerkers.id, bestaand.id));
    medewerkerId = bestaand.id;
  } else {
    const [rij] = await db.insert(schema.medewerkers).values(basis).returning({ id: schema.medewerkers.id });
    medewerkerId = rij.id;
  }

  // Koppel aan alle vestigingen (idempotent)
  for (const d of depts) {
    const [bestaandeKopp] = await db.select()
      .from(schema.medewerkerDepartments)
      .where(eq(schema.medewerkerDepartments.medewerkerId, medewerkerId));
    if (!bestaandeKopp || !depts.find((x) => x.id === bestaandeKopp.departmentId)) {
      // Geen koppeling — maak alle drie aan
      await db.insert(schema.medewerkerDepartments).values(
        depts.map((dd) => ({ medewerkerId, departmentId: dd.id })),
      ).onConflictDoNothing?.() ?? null;
      break;
    }
  }
  // Veiligheidsnet: zorg dat ALLE 3 koppelingen er staan (insert-on-conflict
  // werkt zonder unique constraint niet — eerst kijken wat er al is)
  const huidige = await db.select({ departmentId: schema.medewerkerDepartments.departmentId })
    .from(schema.medewerkerDepartments)
    .where(eq(schema.medewerkerDepartments.medewerkerId, medewerkerId));
  const huidigeSet = new Set(huidige.map((h) => h.departmentId));
  const ontbrekend = depts.filter((d) => !huidigeSet.has(d.id));
  if (ontbrekend.length > 0) {
    await db.insert(schema.medewerkerDepartments)
      .values(ontbrekend.map((d) => ({ medewerkerId, departmentId: d.id })));
  }

  return NextResponse.json({
    ok: true,
    id: medewerkerId,
    email: TEST_EMAIL,
    pin: TEST_PIN,
    bericht: `Test-account klaar. Log in op /m/login?email=${TEST_EMAIL} met PIN ${TEST_PIN}.`,
  });
}
