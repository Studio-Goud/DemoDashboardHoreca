/**
 * GET /api/admin/medewerker-activiteit
 *   → lijst van actieve medewerkers met hun login-status:
 *     - heeftPin       : er is een eigen PIN gezet (pin_hash IS NOT NULL)
 *     - heeftDefaultPin: pin_hash bestaat maar moet_pin_resetten=true (1234)
 *     - heeftPasskey   : ≥1 device geregistreerd voor Face ID / Touch ID
 *     - laatsteLogin   : tijdstip laatste succesvolle login
 *
 * Owner-only.
 */
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { DEMO_MEDEWERKERS } from "@/lib/demo/medewerkers";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      medewerkers: DEMO_MEDEWERKERS.map((m) => ({
        id: m.id,
        naam: `${m.voornaam} ${m.achternaam}`,
        email: m.email,
        heeftPin: true,
        heeftDefaultPin: false,
        heeftPasskey: m.id % 3 === 0,
        passkeyAantal: m.id % 3 === 0 ? 1 : 0,
        laatsteLogin: new Date(Date.now() - m.id * 3600000).toISOString(),
        onboardingVoltooid: true,
        goedgekeurd: true,
      })),
      gegenereerd: new Date().toISOString(),
    });
  }

  // Eén query met LEFT JOIN op een passkey-count subquery zodat we niet N+1
  // hoeven te doen. Postgres count over een join met group-by is hier het
  // simpelst via een correlated subquery.
  const rijen = await db
    .select({
      id: schema.medewerkers.id,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
      email: schema.medewerkers.email,
      pinHashAanwezig: sql<boolean>`${schema.medewerkers.pinHash} IS NOT NULL`,
      moetPinResetten: schema.medewerkers.moetPinResetten,
      laatsteLogin: schema.medewerkers.laatsteLogin,
      onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
      goedgekeurd: schema.medewerkers.goedgekeurd,
      passkeyCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${schema.medewerkerPasskeys}
        WHERE ${schema.medewerkerPasskeys.medewerkerId} = ${schema.medewerkers.id}
      )`,
    })
    .from(schema.medewerkers)
    .where(eq(schema.medewerkers.actief, true));

  return NextResponse.json({
    medewerkers: rijen.map((r) => ({
      id: r.id,
      naam: `${r.voornaam} ${r.achternaam}`.trim(),
      email: r.email,
      heeftPin: r.pinHashAanwezig && !r.moetPinResetten,
      heeftDefaultPin: r.pinHashAanwezig && r.moetPinResetten,
      heeftPasskey: r.passkeyCount > 0,
      passkeyAantal: r.passkeyCount,
      laatsteLogin: r.laatsteLogin?.toISOString() ?? null,
      onboardingVoltooid: r.onboardingVoltooid,
      goedgekeurd: r.goedgekeurd,
    })),
    gegenereerd: new Date().toISOString(),
  });
}
