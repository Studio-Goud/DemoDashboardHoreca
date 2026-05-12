/**
 * Eenmalig migratie-script: kopieer Shiftbase-data naar onze eigen Postgres.
 *
 * Gebruik:
 *   npm run migrate:shiftbase
 *
 * Vereist .env.local met SHIFTBASE_API_KEY en POSTGRES_URL.
 * Idempotent: kan veilig opnieuw gedraaid worden — bestaande records worden
 * herkend via shiftbase_*_id en bijgewerkt.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db, schema } from "../lib/db/client";
import {
  _fetchMedewerkers     as fetchMedewerkers,
  _fetchShiftTemplates  as fetchShiftTemplates,
  _fetchDienstenInRange as fetchDienstenInRange,
  _fetchBeschikbaarheid as fetchBeschikbaarheid,
} from "../lib/shiftbase";
import { eq } from "drizzle-orm";

const BEDRIJVEN: Array<{ slug: "bb" | "sl" | "kl"; naam: string; hex: string; deptId: string; teamId: string }> = [
  { slug: "bb", naam: "Brunch & Brew",    hex: "#0A84FF", deptId: "132936", teamId: "192809" },
  { slug: "sl", naam: "Saté Lounge",      hex: "#30B26F", deptId: "149318", teamId: "221243" },
  { slug: "kl", naam: "Het Kroket Loket", hex: "#E07A1F", deptId: "167737", teamId: "253985" },
];

function isoMinusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}
function isoPlusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}

async function main() {
  console.log("→ Departments seeden…");
  const deptIds: Record<string, number> = {};
  for (const b of BEDRIJVEN) {
    const bestaand = await db.select().from(schema.departments).where(eq(schema.departments.slug, b.slug));
    let id: number;
    if (bestaand.length === 0) {
      const ingevoegd = await db.insert(schema.departments).values({
        slug: b.slug, naam: b.naam, hex: b.hex,
        shiftbaseDepartmentId: b.deptId, shiftbaseTeamId: b.teamId,
      }).returning({ id: schema.departments.id });
      id = ingevoegd[0].id;
    } else {
      id = bestaand[0].id;
    }
    deptIds[b.slug] = id;
    console.log(`   ✓ ${b.naam} (db id=${id})`);
  }

  console.log("→ Medewerkers ophalen uit Shiftbase…");
  const sbMedewerkers = await fetchMedewerkers();
  console.log(`   Gevonden: ${sbMedewerkers.length}`);

  const medewerkerIds: Record<string, number> = {};
  for (const m of sbMedewerkers) {
    const bestaand = await db
      .select({ id: schema.medewerkers.id })
      .from(schema.medewerkers)
      .where(eq(schema.medewerkers.shiftbaseUserId, m.id));

    let id: number;
    if (bestaand.length > 0) {
      id = bestaand[0].id;
      await db.update(schema.medewerkers).set({
        voornaam: m.voornaam,
        achternaam: m.achternaam || "",
        email: m.email || `geen-email-${m.id}@studiogoud.nl`,
        startdatum: m.startdatum,
        einddatum:  m.einddatum,
        avatarUrl:  m.avatar,
        actief:     m.einddatum === null,
        updatedAt:  new Date(),
      }).where(eq(schema.medewerkers.id, id));
    } else {
      const ingevoegd = await db.insert(schema.medewerkers).values({
        voornaam: m.voornaam,
        achternaam: m.achternaam || "",
        email: m.email || `geen-email-${m.id}@studiogoud.nl`,
        startdatum: m.startdatum,
        einddatum:  m.einddatum,
        avatarUrl:  m.avatar,
        actief:     m.einddatum === null,
        shiftbaseUserId: m.id,
      }).returning({ id: schema.medewerkers.id });
      id = ingevoegd[0].id;
    }
    medewerkerIds[m.id] = id;

    // Koppel aan de juiste departments
    for (const bedrijf of m.bedrijven) {
      const deptId = deptIds[bedrijf];
      if (!deptId) continue;
      try {
        await db.insert(schema.medewerkerDepartments).values({
          medewerkerId: id, departmentId: deptId,
        }).onConflictDoNothing();
      } catch {
        // bestond al
      }
    }
  }
  console.log(`   ✓ ${sbMedewerkers.length} medewerkers gesynct`);

  console.log("→ Shift-templates ophalen uit Shiftbase…");
  const sbTemplates = await fetchShiftTemplates();
  console.log(`   Gevonden: ${sbTemplates.length}`);

  const templateIds: Record<string, number> = {};
  for (const t of sbTemplates) {
    const deptId = deptIds[t.bedrijf];
    if (!deptId) continue;
    const bestaand = await db
      .select({ id: schema.shiftTemplates.id })
      .from(schema.shiftTemplates)
      .where(eq(schema.shiftTemplates.shiftbaseShiftId, t.id));
    let id: number;
    if (bestaand.length > 0) {
      id = bestaand[0].id;
      await db.update(schema.shiftTemplates).set({
        departmentId: deptId,
        korteNaam: t.korteNaam,
        langeNaam: t.langeNaam,
        start: `${t.start}:00`,
        eind:  `${t.eind}:00`,
        pauzeMin: t.pauze,
        kleur: t.kleur,
      }).where(eq(schema.shiftTemplates.id, id));
    } else {
      const ingevoegd = await db.insert(schema.shiftTemplates).values({
        departmentId: deptId,
        korteNaam: t.korteNaam,
        langeNaam: t.langeNaam,
        start: `${t.start}:00`,
        eind:  `${t.eind}:00`,
        pauzeMin: t.pauze,
        kleur: t.kleur,
        shiftbaseShiftId: t.id,
      }).returning({ id: schema.shiftTemplates.id });
      id = ingevoegd[0].id;
    }
    templateIds[t.id] = id;
  }
  console.log(`   ✓ ${sbTemplates.length} templates gesynct`);

  // ─── Rosters: laatste 6 maanden + komende 3 maanden ────────────────────
  const start = isoMinusDays(180);
  const eind  = isoPlusDays(90);
  console.log(`→ Rosters ophalen ${start} → ${eind}…`);
  const sbRosters = await fetchDienstenInRange(start, eind);
  console.log(`   Gevonden: ${sbRosters.length}`);

  let nieuwRosters = 0;
  let bijgewerktRosters = 0;
  for (const r of sbRosters) {
    const medewerkerDbId = medewerkerIds[r.medewerker.id];
    const deptDbId       = deptIds[r.bedrijf];
    if (!medewerkerDbId || !deptDbId) continue;

    const bestaand = await db
      .select({ id: schema.rosters.id })
      .from(schema.rosters)
      .where(eq(schema.rosters.shiftbaseRosterId, r.id));

    if (bestaand.length > 0) {
      await db.update(schema.rosters).set({
        medewerkerId: medewerkerDbId,
        departmentId: deptDbId,
        datum: r.datum,
        start: `${r.start}:00`,
        eind:  `${r.eind}:00`,
        gepubliceerd: r.gepubliceerd,
      }).where(eq(schema.rosters.id, bestaand[0].id));
      bijgewerktRosters++;
    } else {
      await db.insert(schema.rosters).values({
        medewerkerId: medewerkerDbId,
        departmentId: deptDbId,
        datum: r.datum,
        start: `${r.start}:00`,
        eind:  `${r.eind}:00`,
        gepubliceerd: r.gepubliceerd,
        shiftbaseRosterId: r.id,
      });
      nieuwRosters++;
    }
  }
  console.log(`   ✓ ${nieuwRosters} nieuw, ${bijgewerktRosters} bijgewerkt`);

  // ─── Beschikbaarheid: komende 60 dagen ─────────────────────────────────
  const bStart = isoPlusDays(0);
  const bEind  = isoPlusDays(60);
  console.log(`→ Beschikbaarheid ophalen ${bStart} → ${bEind}…`);
  const sbBeschikbaar = await fetchBeschikbaarheid(bStart, bEind);
  console.log(`   Gevonden: ${sbBeschikbaar.length}`);

  let nieuwB = 0;
  for (const b of sbBeschikbaar) {
    const medewerkerDbId = medewerkerIds[b.userId];
    if (!medewerkerDbId) continue;
    try {
      await db.insert(schema.beschikbaarheid).values({
        medewerkerId: medewerkerDbId,
        datum: b.datum,
        status: b.status === "onbekend" ? "vrij" : b.status,
        start: b.start ? `${b.start}:00` : null,
        eind:  b.eind  ? `${b.eind}:00`  : null,
        reden: b.reden,
        shiftbaseId: b.id,
      }).onConflictDoUpdate({
        target: [schema.beschikbaarheid.medewerkerId, schema.beschikbaarheid.datum],
        set: {
          status: b.status === "onbekend" ? "vrij" : b.status,
          start: b.start ? `${b.start}:00` : null,
          eind:  b.eind  ? `${b.eind}:00`  : null,
          reden: b.reden,
          shiftbaseId: b.id,
          updatedAt: new Date(),
        },
      });
      nieuwB++;
    } catch (e) {
      console.warn(`   ⚠ Beschikbaarheid ${b.id} overgeslagen: ${e instanceof Error ? e.message : "fout"}`);
    }
  }
  console.log(`   ✓ ${nieuwB} entries gesynct`);

  console.log("");
  console.log("✅ Migratie compleet. Je kunt nu de nieuwe DB gebruiken.");
  console.log("   Test bv. via Drizzle Studio: npx drizzle-kit studio");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Migratie mislukt:", e);
    process.exit(1);
  });
