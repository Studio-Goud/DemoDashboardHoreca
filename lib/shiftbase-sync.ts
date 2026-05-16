/**
 * Herbruikbare Shiftbase → eigen DB sync.
 *
 * Aangeroepen door:
 *   - `/api/admin/shiftbase/sync` (admin-on-demand, default 365d historie)
 *   - `/api/cron/shiftbase-sync`  (nightly, alleen 30d achterstand + 90d vooruit)
 *
 * Idempotent — bestaande rosters worden herkend via `shiftbase_roster_id` en
 * bijgewerkt; nieuwe worden ingevoegd. Verwijderde rosters in Shiftbase worden
 * NIET automatisch uit DB verwijderd (te risicovol voor audit-trail).
 *
 * Medewerker-sync is optioneel (default aan): voor incrementele syncs kun je
 * 'm uitzetten zodat het sneller draait — nieuwe medewerkers komen dan toch
 * binnen via de volgende historie-sync.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "./db/client";
import {
  _fetchMedewerkers     as fetchMedewerkers,
  _fetchDienstenInRange as fetchDienstenInRange,
} from "./shiftbase";

const VESTIGINGEN = [
  { slug: "bb" as const, deptId: "132936" },
  { slug: "sl" as const, deptId: "149318" },
  { slug: "kl" as const, deptId: "167737" },
];

export interface SyncResultaat {
  medewerkersGesynct: number;
  rostersNieuw: number;
  rostersBijgewerkt: number;
  rostersOvergeslagen: number;
  chunks: number;
  duurMs: number;
  errors: string[];
}

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

async function dbDeptIds(): Promise<Record<string, number>> {
  const rows = await db.select({ slug: schema.departments.slug, id: schema.departments.id })
    .from(schema.departments);
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

async function syncMedewerkers(): Promise<Record<string, number>> {
  const sbMedewerkers = await fetchMedewerkers();
  const map: Record<string, number> = {};
  const deptIds = await dbDeptIds();

  for (const m of sbMedewerkers) {
    const [bestaand] = await db
      .select({ id: schema.medewerkers.id })
      .from(schema.medewerkers)
      .where(eq(schema.medewerkers.shiftbaseUserId, m.id));

    let id: number;
    if (bestaand) {
      id = bestaand.id;
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
      const [ingevoegd] = await db.insert(schema.medewerkers).values({
        voornaam: m.voornaam,
        achternaam: m.achternaam || "",
        email: m.email || `geen-email-${m.id}@studiogoud.nl`,
        startdatum: m.startdatum,
        einddatum:  m.einddatum,
        avatarUrl:  m.avatar,
        actief:     m.einddatum === null,
        shiftbaseUserId: m.id,
      }).returning({ id: schema.medewerkers.id });
      id = ingevoegd.id;
    }
    map[m.id] = id;

    // Koppel aan departments (idempotent — primary key voorkomt duplicates)
    for (const bedrijf of m.bedrijven) {
      const deptId = deptIds[bedrijf];
      if (!deptId) continue;
      await db.insert(schema.medewerkerDepartments).values({
        medewerkerId: id,
        departmentId: deptId,
      }).onConflictDoNothing();
    }
  }
  return map;
}

export async function syncShiftbaseRosters(opts: {
  dagenTerug?: number;
  dagenVooruit?: number;
  ookMedewerkers?: boolean;
} = {}): Promise<SyncResultaat> {
  const dagenTerug   = opts.dagenTerug   ?? 365;
  const dagenVooruit = opts.dagenVooruit ?? 90;
  const ookMedewerkers = opts.ookMedewerkers ?? true;

  const start = Date.now();
  const result: SyncResultaat = {
    medewerkersGesynct: 0,
    rostersNieuw: 0,
    rostersBijgewerkt: 0,
    rostersOvergeslagen: 0,
    chunks: 0,
    duurMs: 0,
    errors: [],
  };

  // 1. Medewerker-map (Shiftbase user_id → db id)
  let medewerkerIds: Record<string, number>;
  if (ookMedewerkers) {
    try {
      medewerkerIds = await syncMedewerkers();
      result.medewerkersGesynct = Object.keys(medewerkerIds).length;
    } catch (e) {
      result.errors.push(`medewerker-sync: ${e instanceof Error ? e.message : "fout"}`);
      // val terug op DB-only lookup
      const rows = await db.select({
        id: schema.medewerkers.id,
        sbId: schema.medewerkers.shiftbaseUserId,
      }).from(schema.medewerkers);
      medewerkerIds = Object.fromEntries(
        rows.filter((r): r is { id: number; sbId: string } => r.sbId !== null)
          .map((r) => [r.sbId, r.id]),
      );
    }
  } else {
    const rows = await db.select({
      id: schema.medewerkers.id,
      sbId: schema.medewerkers.shiftbaseUserId,
    }).from(schema.medewerkers);
    medewerkerIds = Object.fromEntries(
      rows.filter((r): r is { id: number; sbId: string } => r.sbId !== null)
        .map((r) => [r.sbId, r.id]),
    );
  }

  const deptIds = await dbDeptIds();

  // 2. Rosters per chunk van 90 dagen (Shiftbase API limiet ~500 records/call)
  const totaalStart = isoMinusDays(dagenTerug);
  const totaalEind  = isoPlusDays(dagenVooruit);
  const chunkDagen = 90;
  const chunks: Array<{ start: string; eind: string }> = [];
  let cursor = totaalStart;
  while (cursor <= totaalEind) {
    const [y, m, d] = cursor.split("-").map(Number);
    const eindDate = new Date(Date.UTC(y, m - 1, d + chunkDagen - 1));
    const eindIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(eindDate);
    const chunkEind = eindIso > totaalEind ? totaalEind : eindIso;
    chunks.push({ start: cursor, eind: chunkEind });
    const volgende = new Date(Date.UTC(y, m - 1, d + chunkDagen));
    cursor = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(volgende);
  }
  result.chunks = chunks.length;

  for (const c of chunks) {
    let sbRosters: Awaited<ReturnType<typeof fetchDienstenInRange>>;
    try {
      sbRosters = await fetchDienstenInRange(c.start, c.eind);
    } catch (e) {
      result.errors.push(`chunk ${c.start}→${c.eind}: ${e instanceof Error ? e.message : "fout"}`);
      continue;
    }

    for (const r of sbRosters) {
      const medewerkerDbId = medewerkerIds[r.medewerker.id];
      const deptDbId       = deptIds[r.bedrijf];
      if (!medewerkerDbId || !deptDbId) {
        result.rostersOvergeslagen++;
        continue;
      }

      const [bestaand] = await db
        .select({ id: schema.rosters.id })
        .from(schema.rosters)
        .where(eq(schema.rosters.shiftbaseRosterId, r.id));

      if (bestaand) {
        await db.update(schema.rosters).set({
          medewerkerId: medewerkerDbId,
          departmentId: deptDbId,
          datum: r.datum,
          start: `${r.start}:00`,
          eind:  `${r.eind}:00`,
          gepubliceerd: r.gepubliceerd,
        }).where(eq(schema.rosters.id, bestaand.id));
        result.rostersBijgewerkt++;
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
        result.rostersNieuw++;
      }
    }
  }

  result.duurMs = Date.now() - start;
  return result;
}

// Voor het VESTIGINGEN-array; gebruikt door eventuele toekomstige helpers.
export { VESTIGINGEN };
