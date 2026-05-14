/**
 * Rooster data-laag — leest/schrijft naar eigen Postgres (Neon) via Drizzle.
 *
 * Vervangt de Shiftbase-bound functies uit lib/shiftbase.ts. Houdt dezelfde
 * publieke API zodat consumers (API routes, server components) ongewijzigd
 * blijven werken.
 *
 * lib/shiftbase.ts blijft bestaan voor het eenmalige migratie-script en kan
 * na Sprint 7 (cutover) verwijderd worden.
 */
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { Bedrijf } from "./sumup";
import { logAudit, snapshotRoster } from "./audit";

// =============================================================================
// Re-export types die de UI gebruikt (compat met oude lib/shiftbase.ts)
// =============================================================================

export interface Dienst {
  id: string;
  datum: string;             // YYYY-MM-DD
  weekdag: number;           // 0=zo..6=za
  start: string;             // HH:MM
  eind: string;              // HH:MM
  uren: number;
  bedrijf: Bedrijf;
  medewerker: {
    id: string;
    naam: string;            // full name
    voornaam: string;
    avatar?: string;
  };
  shiftType: string;
  gepubliceerd: boolean;
}

export interface DagBezetting {
  datum: string;
  weekdag: number;
  label: string;
  aantalMensen: number;
  totaalUren: number;
  diensten: Dienst[];
}

export interface Medewerker {
  id: string;
  voornaam: string;
  achternaam: string;
  naam: string;
  email: string;
  startdatum: string | null;
  einddatum: string | null;
  avatar?: string;
  anoniem: boolean;
  bedrijven: Bedrijf[];
  uurloon: number | null;
  vakantiegeldPct: number;
  vakantieUrenPct: number;
  heeftPin: boolean;
  /** Thuis-vestiging — bron voor inleen-doorberekening. null = nog niet gezet. */
  hoofdDepartmentId: number | null;
}

export interface ShiftTemplate {
  id: string;
  bedrijf: Bedrijf;
  korteNaam: string;
  langeNaam: string;
  start: string;             // HH:MM
  eind: string;              // HH:MM
  pauze: number;             // min
  kleur: string;
}

export type BeschikbaarStatus = "vrij" | "beperkt" | "niet" | "onbekend";

export interface Beschikbaarheid {
  id: string;
  userId: string;
  datum: string;
  status: BeschikbaarStatus;
  start?: string;
  eind?: string;
  reden?: string;
}

// =============================================================================
// Constants & helpers
// =============================================================================

const DAG_LABELS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

// In-memory cache van slug → department.id (1 lookup per cold start)
let slugCache: Record<string, number> | null = null;
async function getSlugMap(): Promise<Record<string, number>> {
  if (slugCache) return slugCache;
  const rows = await db.select({ id: schema.departments.id, slug: schema.departments.slug })
    .from(schema.departments);
  slugCache = Object.fromEntries(rows.map((r) => [r.slug, r.id]));
  return slugCache;
}

async function getDeptId(bedrijf: Bedrijf): Promise<number> {
  const map = await getSlugMap();
  const id = map[bedrijf];
  if (!id) throw new Error(`Onbekend bedrijf: ${bedrijf} (run migrate:shiftbase eerst?)`);
  return id;
}

function tijdNaarHHMM(t: string | null): string {
  if (!t) return "00:00";
  return t.slice(0, 5);
}

function weekdagVanDatum(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function vandaagISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

function isoNDagenVooruit(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}

function berekenUrenUitTijden(start: string, eind: string, pauzeMin: number = 0): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = eind.split(":").map(Number);
  const totaalMin = (eh * 60 + em) - (sh * 60 + sm) - (pauzeMin ?? 0);
  return Math.max(0, totaalMin / 60);
}

// Map een rij uit de join naar een Dienst-object
interface RosterJoinRow {
  id: number;
  datum: string;
  start: string;
  eind: string;
  pauzeMin: number;
  gepubliceerd: boolean;
  shiftTemplateId: number | null;
  // join uit medewerkers
  m_id: number;
  m_voornaam: string;
  m_achternaam: string;
  m_naam: string;
  m_avatar: string | null;
  // join uit departments
  d_slug: string;
  // join uit shift_templates
  t_lange: string | null;
  t_korte: string | null;
}

function mapRow(row: RosterJoinRow): Dienst {
  const start = tijdNaarHHMM(row.start);
  const eind  = tijdNaarHHMM(row.eind);
  return {
    id: String(row.id),
    datum: row.datum,
    weekdag: weekdagVanDatum(row.datum),
    start,
    eind,
    uren: Math.round(berekenUrenUitTijden(start, eind, row.pauzeMin ?? 0) * 100) / 100,
    bedrijf: row.d_slug as Bedrijf,
    medewerker: {
      id: String(row.m_id),
      naam: row.m_naam,
      voornaam: row.m_voornaam,
      avatar: row.m_avatar || undefined,
    },
    shiftType: row.t_lange || row.t_korte || "",
    gepubliceerd: row.gepubliceerd,
  };
}

// =============================================================================
// READS
// =============================================================================

/** Alle diensten in een datumrange (incl. concepten) voor alle vestigingen. */
export async function fetchDienstenInRange(minDate: string, maxDate: string): Promise<Dienst[]> {
  const rows = await db.select({
    id: schema.rosters.id,
    datum: schema.rosters.datum,
    start: schema.rosters.start,
    eind: schema.rosters.eind,
    pauzeMin: schema.rosters.pauzeMin,
    gepubliceerd: schema.rosters.gepubliceerd,
    shiftTemplateId: schema.rosters.shiftTemplateId,
    m_id: schema.medewerkers.id,
    m_voornaam: schema.medewerkers.voornaam,
    m_achternaam: schema.medewerkers.achternaam,
    m_naam: schema.medewerkers.voornaam, // placeholder, hieronder concat
    m_avatar: schema.medewerkers.avatarUrl,
    d_slug: schema.departments.slug,
    t_lange: schema.shiftTemplates.langeNaam,
    t_korte: schema.shiftTemplates.korteNaam,
  })
    .from(schema.rosters)
    .innerJoin(schema.medewerkers, eq(schema.rosters.medewerkerId, schema.medewerkers.id))
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .leftJoin(schema.shiftTemplates, eq(schema.rosters.shiftTemplateId, schema.shiftTemplates.id))
    .where(and(
      gte(schema.rosters.datum, minDate),
      lte(schema.rosters.datum, maxDate),
    ))
    .orderBy(schema.rosters.datum, schema.rosters.start);

  return rows.map((r) => mapRow({
    ...r,
    m_naam: `${r.m_voornaam} ${r.m_achternaam}`.trim(),
  }));
}

function groepeerPerDag(diensten: Dienst[], filterBedrijf?: Bedrijf): DagBezetting[] {
  const perDag = new Map<string, Dienst[]>();
  for (const d of diensten) {
    if (filterBedrijf && d.bedrijf !== filterBedrijf) continue;
    const lijst = perDag.get(d.datum) ?? [];
    lijst.push(d);
    perDag.set(d.datum, lijst);
  }
  return Array.from(perDag.entries())
    .map(([datum, diensten]) => {
      const uniekeMensen = new Set(diensten.map((d) => d.medewerker.id));
      const totaalUren = diensten.reduce((s, d) => s + d.uren, 0);
      const wd = diensten[0].weekdag;
      return {
        datum,
        weekdag: wd,
        label: `${DAG_LABELS[wd]} ${datum.slice(8)}-${datum.slice(5, 7)}`,
        aantalMensen: uniekeMensen.size,
        totaalUren: Math.round(totaalUren * 10) / 10,
        diensten: diensten.sort((a, b) => a.start.localeCompare(b.start)),
      };
    })
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export async function dienstenVandaag(bedrijf: Bedrijf): Promise<Dienst[]> {
  const vandaag = vandaagISO();
  const alle = await fetchDienstenInRange(vandaag, vandaag);
  return alle
    .filter((d) => d.bedrijf === bedrijf && d.gepubliceerd)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function bezettingKomendePeriode(
  bedrijf: Bedrijf,
  dagenVooruit = 14,
): Promise<DagBezetting[]> {
  const vandaag = vandaagISO();
  const grens = isoNDagenVooruit(dagenVooruit);
  const alle = await fetchDienstenInRange(vandaag, grens);
  return groepeerPerDag(alle.filter((d) => d.gepubliceerd), bedrijf);
}

export async function komendeDiensten(
  dagVooruitMax = 14,
  bedrijf?: Bedrijf,
): Promise<{ datum: string; label: string; mensen: string[]; aantalMensen: number }[]> {
  const vandaag = vandaagISO();
  const grens = isoNDagenVooruit(dagVooruitMax);
  const alle = await fetchDienstenInRange(vandaag, grens);
  const gegroepeerd = groepeerPerDag(alle.filter((d) => d.gepubliceerd), bedrijf);
  return gegroepeerd.map((g) => ({
    datum: g.datum,
    label: g.label,
    mensen: Array.from(new Set(g.diensten.map((d) => d.medewerker.naam))),
    aantalMensen: g.aantalMensen,
  }));
}

export async function bezettingPerWeekdag(
  bedrijf: Bedrijf,
): Promise<{ weekdag: number; label: string; gemMensen: number; gemUren: number }[]> {
  const eind = vandaagISO();
  const start = isoNDagenVooruit(-90);
  const alle = await fetchDienstenInRange(start, eind);
  const gegroepeerd = groepeerPerDag(alle.filter((d) => d.gepubliceerd), bedrijf);
  const perWd = new Map<number, { mensen: number[]; uren: number[] }>();
  for (const dag of gegroepeerd) {
    const entry = perWd.get(dag.weekdag) ?? { mensen: [], uren: [] };
    entry.mensen.push(dag.aantalMensen);
    entry.uren.push(dag.totaalUren);
    perWd.set(dag.weekdag, entry);
  }
  return Array.from(perWd.entries())
    .map(([wd, v]) => ({
      weekdag: wd,
      label: DAG_LABELS[wd],
      gemMensen: Math.round((v.mensen.reduce((s, x) => s + x, 0) / v.mensen.length) * 10) / 10,
      gemUren: Math.round((v.uren.reduce((s, x) => s + x, 0) / v.uren.length) * 10) / 10,
    }))
    .sort((a, b) => a.weekdag - b.weekdag);
}

// ─── Medewerkers ────────────────────────────────────────────────────────────

export async function fetchMedewerkers(): Promise<Medewerker[]> {
  const rows = await db.select({
    m: schema.medewerkers,
    deptSlug: schema.departments.slug,
  })
    .from(schema.medewerkers)
    .leftJoin(schema.medewerkerDepartments, eq(schema.medewerkers.id, schema.medewerkerDepartments.medewerkerId))
    .leftJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
    .where(eq(schema.medewerkers.actief, true));

  // Aggregeer departments per medewerker
  const map = new Map<number, Medewerker>();
  for (const row of rows) {
    const m = row.m;
    if (!map.has(m.id)) {
      map.set(m.id, {
        id: String(m.id),
        voornaam: m.voornaam,
        achternaam: m.achternaam,
        naam: `${m.voornaam} ${m.achternaam}`.trim(),
        email: m.email,
        startdatum: m.startdatum,
        einddatum: m.einddatum,
        avatar: m.avatarUrl ?? undefined,
        anoniem: false,
        bedrijven: [],
        uurloon: m.uurloon === null ? null : Number(m.uurloon),
        vakantiegeldPct: m.vakantiegeldPct === null ? 8.33 : Number(m.vakantiegeldPct),
        vakantieUrenPct: m.vakantieUrenPct === null ? 8.00 : Number(m.vakantieUrenPct),
        heeftPin: !!m.pinHash,
        hoofdDepartmentId: m.hoofdDepartmentId ?? null,
      });
    }
    if (row.deptSlug) {
      const slug = row.deptSlug as Bedrijf;
      const mw = map.get(m.id)!;
      if (!mw.bedrijven.includes(slug)) mw.bedrijven.push(slug);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.voornaam.localeCompare(b.voornaam));
}

export async function medewerkersPerBedrijf(bedrijf: Bedrijf): Promise<Medewerker[]> {
  const alle = await fetchMedewerkers();
  return alle.filter((m) => m.bedrijven.includes(bedrijf));
}

// ─── Shift templates ────────────────────────────────────────────────────────

export async function fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  const rows = await db.select({
    t: schema.shiftTemplates,
    d_slug: schema.departments.slug,
  })
    .from(schema.shiftTemplates)
    .innerJoin(schema.departments, eq(schema.shiftTemplates.departmentId, schema.departments.id))
    .where(eq(schema.shiftTemplates.verwijderd, false));
  return rows.map((row) => ({
    id: String(row.t.id),
    bedrijf: row.d_slug as Bedrijf,
    korteNaam: row.t.korteNaam,
    langeNaam: row.t.langeNaam,
    start: tijdNaarHHMM(row.t.start),
    eind:  tijdNaarHHMM(row.t.eind),
    pauze: row.t.pauzeMin,
    kleur: row.t.kleur,
  })).sort((a, b) => a.start.localeCompare(b.start));
}

export async function shiftTemplatesPerBedrijf(bedrijf: Bedrijf): Promise<ShiftTemplate[]> {
  const alle = await fetchShiftTemplates();
  return alle.filter((t) => t.bedrijf === bedrijf);
}

// ─── Beschikbaarheid ────────────────────────────────────────────────────────

export async function fetchBeschikbaarheid(minDate: string, maxDate: string): Promise<Beschikbaarheid[]> {
  const rows = await db.select()
    .from(schema.beschikbaarheid)
    .where(and(
      gte(schema.beschikbaarheid.datum, minDate),
      lte(schema.beschikbaarheid.datum, maxDate),
    ));
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.medewerkerId),
    datum: r.datum,
    status: r.status as BeschikbaarStatus,
    start: r.start ? tijdNaarHHMM(r.start) : undefined,
    eind:  r.eind  ? tijdNaarHHMM(r.eind)  : undefined,
    reden: r.reden ?? undefined,
  }));
}

// =============================================================================
// WRITES
// =============================================================================

export interface NieuweDienst {
  bedrijf: Bedrijf;
  userId: string;            // medewerker.id als string
  datum: string;             // YYYY-MM-DD
  start: string;             // HH:MM
  eind: string;              // HH:MM
  shiftTemplateId?: string;
  pauzeMin?: number;
  notitie?: string;
  gepubliceerd?: boolean;
}

function tijdNaarFull(hhmm: string): string {
  return /^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : hhmm;
}

// Audit-context die we doorgeven aan create/update/delete operaties. Bewust
// optioneel — als geen context wordt meegegeven loggen we als 'systeem'.
export interface AuditMeta {
  doorMedewerkerId?: number | null;
  doorRol?: "owner" | "manager" | "medewerker" | "systeem";
  reden?: string;
  ipAdres?: string;
  userAgent?: string;
}

export async function createRoster(data: NieuweDienst, meta?: AuditMeta): Promise<{ id: string }> {
  const deptId = await getDeptId(data.bedrijf);
  const values = {
    medewerkerId: Number(data.userId),
    departmentId: deptId,
    shiftTemplateId: data.shiftTemplateId ? Number(data.shiftTemplateId) : null,
    datum: data.datum,
    start: tijdNaarFull(data.start),
    eind:  tijdNaarFull(data.eind),
    pauzeMin: data.pauzeMin ?? 0,
    notitie: data.notitie,
    gepubliceerd: data.gepubliceerd ?? false,
  };
  const ingevoegd = await db.insert(schema.rosters).values(values).returning();
  const row = ingevoegd[0];

  await logAudit("roster", row.id, "create", null, snapshotRoster(row), meta);
  return { id: String(row.id) };
}

export async function updateRoster(
  id: string,
  patch: Partial<NieuweDienst> & { bedrijf: Bedrijf },
  meta?: AuditMeta,
): Promise<void> {
  const updates: Partial<typeof schema.rosters.$inferInsert> = {};
  if (patch.userId)          updates.medewerkerId = Number(patch.userId);
  if (patch.shiftTemplateId !== undefined) updates.shiftTemplateId = patch.shiftTemplateId ? Number(patch.shiftTemplateId) : null;
  if (patch.datum)           updates.datum = patch.datum;
  if (patch.start)           updates.start = tijdNaarFull(patch.start);
  if (patch.eind)            updates.eind  = tijdNaarFull(patch.eind);
  if (patch.pauzeMin !== undefined) updates.pauzeMin = patch.pauzeMin;
  if (patch.notitie !== undefined)  updates.notitie = patch.notitie;
  if (patch.gepubliceerd !== undefined) updates.gepubliceerd = patch.gepubliceerd;
  if (patch.bedrijf) {
    updates.departmentId = await getDeptId(patch.bedrijf);
  }
  if (Object.keys(updates).length === 0) return;

  // Snapshot vóór update voor audit
  const voor = await db.select().from(schema.rosters).where(eq(schema.rosters.id, Number(id)));
  await db.update(schema.rosters).set(updates).where(eq(schema.rosters.id, Number(id)));
  const na = await db.select().from(schema.rosters).where(eq(schema.rosters.id, Number(id)));

  if (voor[0] && na[0]) {
    await logAudit(
      "roster",
      Number(id),
      "update",
      snapshotRoster(voor[0]),
      snapshotRoster(na[0]),
      meta,
    );
  }
}

export async function deleteRoster(id: string, meta?: AuditMeta): Promise<void> {
  // Snapshot vóór delete — anders weten we niet meer wat er stond
  const voor = await db.select().from(schema.rosters).where(eq(schema.rosters.id, Number(id)));
  await db.delete(schema.rosters).where(eq(schema.rosters.id, Number(id)));
  if (voor[0]) {
    await logAudit("roster", Number(id), "delete", snapshotRoster(voor[0]), null, meta);
  }
}

export async function publiceerWeek(
  bedrijf: Bedrijf,
  startDatum: string,
  eindDatum: string,
  meta?: AuditMeta,
): Promise<number> {
  const deptId = await getDeptId(bedrijf);
  // Eerst de concepten ophalen — we hebben hun snapshot nodig voor audit
  const concepten = await db.select()
    .from(schema.rosters)
    .where(and(
      eq(schema.rosters.departmentId, deptId),
      eq(schema.rosters.gepubliceerd, false),
      gte(schema.rosters.datum, startDatum),
      lte(schema.rosters.datum, eindDatum),
    ));
  if (concepten.length === 0) return 0;
  await db.update(schema.rosters)
    .set({ gepubliceerd: true })
    .where(inArray(schema.rosters.id, concepten.map((c) => c.id)));

  // Log elke gepubliceerde concept als audit-event
  for (const c of concepten) {
    await logAudit(
      "roster",
      c.id,
      "update",
      snapshotRoster(c),
      snapshotRoster({ ...c, gepubliceerd: true }),
      { ...meta, reden: meta?.reden ?? "Week-publicatie" },
    );
  }
  return concepten.length;
}

// ─── Medewerker CRUD ────────────────────────────────────────────────────────

export interface NieuweMedewerker {
  bedrijf: Bedrijf;
  voornaam: string;
  achternaam: string;
  email: string;
  startdatum?: string;
}

export async function createMedewerker(data: NieuweMedewerker): Promise<{ id: string }> {
  const deptId = await getDeptId(data.bedrijf);
  const ingevoegd = await db.insert(schema.medewerkers).values({
    voornaam: data.voornaam,
    achternaam: data.achternaam,
    email: data.email,
    startdatum: data.startdatum ?? new Intl.DateTimeFormat("sv-SE").format(new Date()),
    actief: true,
  }).returning({ id: schema.medewerkers.id });
  const id = ingevoegd[0].id;
  // Koppel aan vestiging
  await db.insert(schema.medewerkerDepartments).values({
    medewerkerId: id, departmentId: deptId,
  }).onConflictDoNothing();
  return { id: String(id) };
}

export interface MedewerkerPatch {
  voornaam?: string;
  achternaam?: string;
  email?: string;
  startdatum?: string;
  einddatum?: string | null;
  uurloon?: number | null;             // in euro
  vakantiegeldPct?: number;            // bv. 8.33
  vakantieUrenPct?: number;            // bv. 8.00
  /** Thuis-vestiging (department.id). null = ontkoppelen. */
  hoofdDepartmentId?: number | null;
}

export async function updateMedewerker(id: string, patch: MedewerkerPatch): Promise<void> {
  const updates: Partial<typeof schema.medewerkers.$inferInsert> = { updatedAt: new Date() };
  if (patch.voornaam   !== undefined) updates.voornaam = patch.voornaam;
  if (patch.achternaam !== undefined) updates.achternaam = patch.achternaam;
  if (patch.email      !== undefined) updates.email = patch.email;
  if (patch.startdatum !== undefined) updates.startdatum = patch.startdatum;
  if (patch.einddatum  !== undefined) {
    updates.einddatum = patch.einddatum;
    if (patch.einddatum !== null) updates.actief = false;
  }
  if (patch.uurloon !== undefined) {
    updates.uurloon = patch.uurloon === null ? null : String(patch.uurloon);
  }
  if (patch.vakantiegeldPct !== undefined) updates.vakantiegeldPct = String(patch.vakantiegeldPct);
  if (patch.vakantieUrenPct !== undefined) updates.vakantieUrenPct = String(patch.vakantieUrenPct);
  if (patch.hoofdDepartmentId !== undefined) updates.hoofdDepartmentId = patch.hoofdDepartmentId;
  await db.update(schema.medewerkers).set(updates).where(eq(schema.medewerkers.id, Number(id)));
}

export async function deleteMedewerker(id: string): Promise<void> {
  // Soft-delete: einddatum = vandaag + actief = false
  const vandaag = new Intl.DateTimeFormat("sv-SE").format(new Date());
  await db.update(schema.medewerkers).set({
    einddatum: vandaag,
    actief: false,
    updatedAt: new Date(),
  }).where(eq(schema.medewerkers.id, Number(id)));
}
