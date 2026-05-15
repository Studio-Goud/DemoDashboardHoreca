/**
 * Eenmalige seed van een test-medewerker met PIN 1111 voor smoke-testing.
 *
 * POST /api/admin/seed-test-medewerker (owner-only)
 *   → { ok, id, email, pin, autoLogin, bericht }
 *
 * Idempotent — meermaals aanroepen reset de PIN naar 1111 en zet alle
 * onboarding-velden terug op compleet. Logt zichzelf direct in als de
 * test-medewerker (medewerker-cookie), de owner-admin-cookie blijft staan.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { hashPin, inloggenMedewerker } from "@/lib/auth";
import { versleutelTekst } from "@/lib/documenten";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";

const TEST_EMAIL = "test@markthal.local";
const TEST_PIN = "1111";

export async function POST() {
  try {
    await runAllePendingMigraties().catch(() => null);

    const adminSessie = huidigeAdminSessie();
    if (!adminSessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
    if (adminSessie.rol !== "owner") {
      return NextResponse.json({ error: "alleen owner" }, { status: 403 });
    }

    const pinHash = await hashPin(TEST_PIN);
    let bsnEnc: string | null = null;
    try { bsnEnc = versleutelTekst("123456782"); } catch (e) {
      console.warn("[seed-test] BSN encryptie skipped:", e instanceof Error ? e.message : e);
    }

    // Departments ophalen — koppelen aan alle drie
    const depts = await db.select({ id: schema.departments.id, slug: schema.departments.slug })
      .from(schema.departments);
    if (depts.length === 0) {
      return NextResponse.json({ error: "Geen departments in DB — run eerst de Setup" }, { status: 500 });
    }
    const bb = depts.find((d) => d.slug === "bb") ?? depts[0];

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
      goedgekeurdDoor: adminSessie.naam,
      hoofdDepartmentId: bb.id,
      actief: true,
    };

    let medewerkerId: number;
    if (bestaand) {
      await db.update(schema.medewerkers).set(basis).where(eq(schema.medewerkers.id, bestaand.id));
      medewerkerId = bestaand.id;
    } else {
      const [rij] = await db.insert(schema.medewerkers).values(basis).returning({ id: schema.medewerkers.id });
      medewerkerId = rij.id;
    }

    // Koppelen aan vestigingen — simpele safety-net: kijk welke al bestaan
    // en voeg ontbrekenden toe. Geen onConflictDoNothing nodig.
    const huidige = await db.select({ departmentId: schema.medewerkerDepartments.departmentId })
      .from(schema.medewerkerDepartments)
      .where(eq(schema.medewerkerDepartments.medewerkerId, medewerkerId));
    const huidigeSet = new Set(huidige.map((h) => h.departmentId));
    const ontbrekend = depts.filter((d) => !huidigeSet.has(d.id));
    if (ontbrekend.length > 0) {
      await db.insert(schema.medewerkerDepartments)
        .values(ontbrekend.map((d) => ({ medewerkerId, departmentId: d.id })));
    }

    // Direct inloggen — zet medewerker-sessie cookie naast owner-admin cookie
    let autoLogin = false;
    try {
      const sessie = await inloggenMedewerker(TEST_EMAIL, TEST_PIN);
      autoLogin = sessie !== null;
    } catch (e) {
      console.warn("[seed-test] auto-login failed:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({
      ok: true,
      id: medewerkerId,
      email: TEST_EMAIL,
      pin: TEST_PIN,
      autoLogin,
      bericht: autoLogin
        ? "Klaar! Je bent automatisch ingelogd als test-medewerker. Open /m om te testen — je owner-sessie blijft actief."
        : `Test-account klaar. Log in op /m/login?email=${TEST_EMAIL} met PIN ${TEST_PIN}.`,
    });
  } catch (e) {
    console.error("[seed-test-medewerker] onverwachte fout:", e);
    return NextResponse.json(
      { error: e instanceof Error ? `${e.name}: ${e.message}` : "Onbekende fout" },
      { status: 500 },
    );
  }
}
