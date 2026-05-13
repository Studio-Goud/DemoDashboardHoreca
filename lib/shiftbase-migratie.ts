/**
 * Shiftbase-migratie als lib-functie.
 *
 * Identiek aan scripts/migrate-shiftbase-naar-db.ts maar zonder dotenv
 * (env-vars staan al op productie), aanroepbaar vanuit een API-route
 * zodat de owner het kan triggeren vanaf zijn telefoon zonder shell.
 *
 * Idempotent: bij herhaaldelijk aanroepen worden bestaande records via
 * shiftbase_*_id herkend en bijgewerkt.
 */

import { db, schema } from "./db/client";
import {
  _fetchMedewerkers     as fetchMedewerkers,
  _fetchShiftTemplates  as fetchShiftTemplates,
  _fetchDienstenInRange as fetchDienstenInRange,
  _fetchBeschikbaarheid as fetchBeschikbaarheid,
} from "./shiftbase";
import { eq } from "drizzle-orm";

const BEDRIJVEN: Array<{
  slug: "bb" | "sl" | "kl";
  naam: string;
  hex: string;
  deptId: string;
  teamId: string;
}> = [
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

export interface MigratieResultaat {
  departments: number;
  medewerkersNieuw: number;
  medewerkersBijgewerkt: number;
  templatesGesynct: number;
  rostersNieuw: number;
  rostersBijgewerkt: number;
  beschikbaarheidGesynct: number;
  duurMs: number;
  log: string[];
}

/**
 * Voer de hele migratie uit. Idempotent.
 *
 * Parameters:
 * - dagenHistorie: hoeveel dagen TERUG ophalen (default 365 = 12 maanden)
 * - dagenVooruit:  hoeveel dagen vooruit (default 90, voor reeds geplande
 *                  toekomstige shifts)
 */
export async function migreerShiftbase({
  dagenHistorie = 365,
  dagenVooruit = 90,
}: {
  dagenHistorie?: number;
  dagenVooruit?: number;
} = {}): Promise<MigratieResultaat> {
  const start = Date.now();
  const log: string[] = [];
  const push = (s: string) => log.push(s);

  // ─── Departments ─────────────────────────────────────────────────────────
  push("→ Departments seeden…");
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
    push(`   ✓ ${b.naam} (db id=${id})`);
  }

  // ─── Medewerkers ─────────────────────────────────────────────────────────
  push("→ Medewerkers ophalen uit Shiftbase…");
  const sbMedewerkers = await fetchMedewerkers();
  push(`   Gevonden: ${sbMedewerkers.length}`);

  let medewerkersNieuw = 0;
  let medewerkersBijgewerkt = 0;
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
        email: m.email || `geen-email-${m.id}@markthal-hq.nl`,
        startdatum: m.startdatum,
        einddatum:  m.einddatum,
        avatarUrl:  m.avatar,
        actief:     m.einddatum === null,
        updatedAt:  new Date(),
      }).where(eq(schema.medewerkers.id, id));
      medewerkersBijgewerkt++;
    } else {
      const ingevoegd = await db.insert(schema.medewerkers).values({
        voornaam: m.voornaam,
        achternaam: m.achternaam || "",
        email: m.email || `geen-email-${m.id}@markthal-hq.nl`,
        startdatum: m.startdatum,
        einddatum:  m.einddatum,
        avatarUrl:  m.avatar,
        actief:     m.einddatum === null,
        shiftbaseUserId: m.id,
      }).returning({ id: schema.medewerkers.id });
      id = ingevoegd[0].id;
      medewerkersNieuw++;
    }
    medewerkerIds[m.id] = id;

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
  push(`   ✓ ${medewerkersNieuw} nieuw, ${medewerkersBijgewerkt} bijgewerkt`);

  // ─── Shift-templates ─────────────────────────────────────────────────────
  push("→ Shift-templates ophalen uit Shiftbase…");
  const sbTemplates = await fetchShiftTemplates();
  push(`   Gevonden: ${sbTemplates.length}`);

  let templatesGesynct = 0;
  for (const t of sbTemplates) {
    const deptId = deptIds[t.bedrijf];
    if (!deptId) continue;
    const bestaand = await db
      .select({ id: schema.shiftTemplates.id })
      .from(schema.shiftTemplates)
      .where(eq(schema.shiftTemplates.shiftbaseShiftId, t.id));
    if (bestaand.length > 0) {
      await db.update(schema.shiftTemplates).set({
        departmentId: deptId,
        korteNaam: t.korteNaam,
        langeNaam: t.langeNaam,
        start: `${t.start}:00`,
        eind:  `${t.eind}:00`,
        pauzeMin: t.pauze,
        kleur: t.kleur,
      }).where(eq(schema.shiftTemplates.id, bestaand[0].id));
    } else {
      await db.insert(schema.shiftTemplates).values({
        departmentId: deptId,
        korteNaam: t.korteNaam,
        langeNaam: t.langeNaam,
        start: `${t.start}:00`,
        eind:  `${t.eind}:00`,
        pauzeMin: t.pauze,
        kleur: t.kleur,
        shiftbaseShiftId: t.id,
      });
    }
    templatesGesynct++;
  }
  push(`   ✓ ${templatesGesynct} templates gesynct`);

  // ─── Rosters (chunked) ───────────────────────────────────────────────────
  const totaalStart = isoMinusDays(dagenHistorie);
  const totaalEind  = isoPlusDays(dagenVooruit);
  push(`→ Rosters ophalen ${totaalStart} → ${totaalEind} (chunked per 90 dagen)…`);

  const chunkDagen = 90;
  const chunks: Array<{ start: string; eind: string }> = [];
  let chunkStart = totaalStart;
  while (chunkStart <= totaalEind) {
    const [y, m, d] = chunkStart.split("-").map(Number);
    const eindDate = new Date(Date.UTC(y, m - 1, d + chunkDagen - 1));
    const eindIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(eindDate);
    const chunkEind = eindIso > totaalEind ? totaalEind : eindIso;
    chunks.push({ start: chunkStart, eind: chunkEind });
    const volgende = new Date(Date.UTC(y, m - 1, d + chunkDagen));
    chunkStart = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(volgende);
  }

  let rostersNieuw = 0;
  let rostersBijgewerkt = 0;
  for (let idx = 0; idx < chunks.length; idx++) {
    const c = chunks[idx];
    push(`   blok ${idx + 1}/${chunks.length}: ${c.start} → ${c.eind}`);
    const sbRosters = await fetchDienstenInRange(c.start, c.eind);
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
        rostersBijgewerkt++;
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
        rostersNieuw++;
      }
    }
  }
  push(`   ✓ ${rostersNieuw} nieuw, ${rostersBijgewerkt} bijgewerkt`);

  // ─── Beschikbaarheid (komende 60 dagen) ──────────────────────────────────
  const bStart = isoPlusDays(0);
  const bEind  = isoPlusDays(60);
  push(`→ Beschikbaarheid ophalen ${bStart} → ${bEind}…`);
  const sbBeschikbaar = await fetchBeschikbaarheid(bStart, bEind);
  push(`   Gevonden: ${sbBeschikbaar.length}`);

  let beschikbaarheidGesynct = 0;
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
      beschikbaarheidGesynct++;
    } catch {
      // skip
    }
  }
  push(`   ✓ ${beschikbaarheidGesynct} entries gesynct`);

  push("");
  push("✅ Migratie compleet.");

  return {
    departments: BEDRIJVEN.length,
    medewerkersNieuw,
    medewerkersBijgewerkt,
    templatesGesynct,
    rostersNieuw,
    rostersBijgewerkt,
    beschikbaarheidGesynct,
    duurMs: Date.now() - start,
    log,
  };
}
