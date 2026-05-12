import { unstable_cache } from "next/cache";
import type { Bedrijf } from "./sumup";

const SHIFTBASE_BASE = "https://api.shiftbase.com/api";

const DEPARTMENT_ID: Record<Bedrijf, string> = {
  bb: "132936", // Brunch and Brew
  sl: "149318", // Saté Lounge
  kl: "167737", // Het Kroket Loket
};

const BEDRIJF_VAN_DEPARTMENT: Record<string, Bedrijf> = {
  "132936": "bb",
  "149318": "sl",
  "167737": "kl",
};

const DAG_LABELS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

export interface Dienst {
  id: string;
  datum: string;       // YYYY-MM-DD
  weekdag: number;     // 0=zo..6=za
  start: string;       // HH:MM
  eind: string;        // HH:MM
  uren: number;
  bedrijf: Bedrijf;
  medewerker: {
    id: string;
    naam: string;
    voornaam: string;
    avatar?: string;
  };
  shiftType: string;   // bv. "Ochtend", "Avond"
  gepubliceerd: boolean;
}

export interface DagBezetting {
  datum: string;       // YYYY-MM-DD
  weekdag: number;
  label: string;       // "Dinsdag 12-05"
  aantalMensen: number;
  totaalUren: number;
  diensten: Dienst[];
}

interface RosterApiItem {
  Roster: {
    id: string;
    department_id: string;
    date: string;
    starttime: string;
    endtime: string;
    hours: number | string;
    published: boolean;
    name: string;
  };
  User: {
    id: string;
    name: string;
    first_name: string;
    avatar_30x30?: string;
  };
  Shift: {
    long_name: string;
    name: string;
  };
}

interface RosterApiResponse {
  data: RosterApiItem[];
  meta: { status: string };
}

function getApiKey(): string {
  const key = process.env.SHIFTBASE_API_KEY;
  if (!key) throw new Error("SHIFTBASE_API_KEY ontbreekt in environment variables");
  return key;
}

async function shiftbaseFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${SHIFTBASE_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `API ${getApiKey()}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shiftbase API ${res.status} op ${endpoint}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function tijdNaarHHMM(t: string): string {
  // "09:30:00" → "09:30"
  return t.slice(0, 5);
}

function weekdagVanDatum(dateStr: string): number {
  // Veilig zonder timezone-issues: parse YYYY-MM-DD als UTC en gebruik UTC day
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function mapRoster(item: RosterApiItem): Dienst | null {
  const r = item.Roster;
  const bedrijf = BEDRIJF_VAN_DEPARTMENT[r.department_id];
  if (!bedrijf) return null;

  return {
    id: r.id,
    datum: r.date,
    weekdag: weekdagVanDatum(r.date),
    start: tijdNaarHHMM(r.starttime),
    eind: tijdNaarHHMM(r.endtime),
    uren: typeof r.hours === "string" ? parseFloat(r.hours) : r.hours,
    bedrijf,
    medewerker: {
      id: item.User.id,
      naam: item.User.name,
      voornaam: item.User.first_name,
      avatar: item.User.avatar_30x30,
    },
    shiftType: item.Shift?.long_name || item.Shift?.name || r.name,
    gepubliceerd: r.published,
  };
}

// Ruwe diensten ophalen voor een datumrange (gecached 5 min)
async function _fetchDienstenInRange(minDate: string, maxDate: string): Promise<Dienst[]> {
  // Shiftbase paginated: we kunnen niet zomaar 1 grote call doen voor lange periodes.
  // Voor periodes ≤ 90 dagen werkt limit=500 prima.
  const json = await shiftbaseFetch<RosterApiResponse>("/rosters", {
    min_date: minDate,
    max_date: maxDate,
    limit: "500",
  });

  // Retourneer ALLE diensten (gepubliceerd + concept). Consumers die alleen
  // gepubliceerde willen filteren zelf via `d.gepubliceerd`.
  return json.data
    .map(mapRoster)
    .filter((d): d is Dienst => d !== null);
}

export const fetchDienstenInRange = unstable_cache(
  _fetchDienstenInRange,
  ["shiftbase-diensten-range"],
  { revalidate: 300, tags: ["shiftbase"] },
);

function vandaagISO(): string {
  // Lokale tijd, formaat YYYY-MM-DD (Europe/Amsterdam)
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

function isoNDagenVooruit(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}

// Groepeer diensten per dag, optioneel gefilterd op bedrijf
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

// --- Public API ----------------------------------------------------------

// Diensten van vandaag voor één bedrijf (alleen gepubliceerd)
export async function dienstenVandaag(bedrijf: Bedrijf): Promise<Dienst[]> {
  const vandaag = vandaagISO();
  const alle = await fetchDienstenInRange(vandaag, vandaag);
  return alle
    .filter((d) => d.bedrijf === bedrijf && d.gepubliceerd)
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Bezetting per dag voor één bedrijf, komende N dagen (incl. vandaag)
export async function bezettingKomendePeriode(
  bedrijf: Bedrijf,
  dagenVooruit = 14,
): Promise<DagBezetting[]> {
  const vandaag = vandaagISO();
  const grens = isoNDagenVooruit(dagenVooruit);
  const alle = await fetchDienstenInRange(vandaag, grens);
  return groepeerPerDag(alle.filter((d) => d.gepubliceerd), bedrijf);
}

// Backwards-compat: vroeger gebruikt op dashboard om "hoeveel mensen vandaag"
// te tonen. Nu bedrijfsspecifiek - oude code riep zonder bedrijf aan en
// kreeg alle bedrijven door elkaar; daarom optionele bedrijf-parameter.
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

// Bezetting per weekdag (laatste 90 dagen historie) — voor patroon-analyse
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

// =============================================================================
// EDITOR-LAAG: medewerkers + shift templates + CRUD op rosters en users
// =============================================================================

// Team-id's per vestiging (uit echte Shiftbase-account 95253)
const TEAM_ID: Record<Bedrijf, string> = {
  bb: "192809", // Brunch and Brew
  sl: "221243", // Saté Lounge
  kl: "253985", // Het Kroket Loket
};

export interface Medewerker {
  id: string;
  voornaam: string;
  achternaam: string;
  naam: string;            // full display name
  email: string;
  startdatum: string | null;
  einddatum: string | null;
  avatar?: string;
  anoniem: boolean;
  bedrijven: Bedrijf[];     // welke vestigingen via teams
}

export interface ShiftTemplate {
  id: string;
  bedrijf: Bedrijf;
  korteNaam: string;        // bv. "MORN"
  langeNaam: string;        // bv. "Ochtend"
  start: string;            // HH:MM
  eind: string;             // HH:MM
  pauze: number;            // minuten
  kleur: string;
}

interface UserApiItem {
  User: {
    id: string;
    first_name: string;
    last_name: string;
    prefix: string;
    name: string;
    email: string;
    startdate: string | null;
    enddate: string | null;
    avatar_30x30?: string;
    anonymized?: boolean;
  };
  Team?: Array<{ id: string; department_id: string; name: string }>;
}

interface UsersApiResponse { data: UserApiItem[]; meta: { status: string } }

interface ShiftTemplateApiItem {
  Shift: {
    id: string;
    department_id: string;
    name: string;
    long_name: string;
    starttime: string;
    endtime: string;
    break: string | number;
    color: string;
    deleted?: boolean;
    is_task?: boolean;
  };
}
interface ShiftTemplatesApiResponse { data: ShiftTemplateApiItem[]; meta: { status: string } }

function mapUser(item: UserApiItem): Medewerker {
  const teams = item.Team ?? [];
  const bedrijven = Array.from(
    new Set(
      teams
        .map((t) => BEDRIJF_VAN_DEPARTMENT[t.department_id])
        .filter((b): b is Bedrijf => b !== undefined),
    ),
  );
  return {
    id: item.User.id,
    voornaam: item.User.first_name,
    achternaam: [item.User.prefix, item.User.last_name].filter(Boolean).join(" ").trim(),
    naam: item.User.name,
    email: item.User.email,
    startdatum: item.User.startdate,
    einddatum: item.User.enddate,
    avatar: item.User.avatar_30x30,
    anoniem: !!item.User.anonymized,
    bedrijven,
  };
}

async function _fetchMedewerkers(): Promise<Medewerker[]> {
  // Shiftbase paginate-veilig: 500 is genoeg voor alle medewerkers in 1 account
  const json = await shiftbaseFetch<UsersApiResponse>("/users", { limit: "500" });
  return json.data.map(mapUser).filter((m) => !m.anoniem && m.einddatum === null);
}

export const fetchMedewerkers = unstable_cache(
  _fetchMedewerkers,
  ["shiftbase-medewerkers"],
  { revalidate: 300, tags: ["shiftbase", "shiftbase-medewerkers"] },
);

export async function medewerkersPerBedrijf(bedrijf: Bedrijf): Promise<Medewerker[]> {
  const alle = await fetchMedewerkers();
  return alle
    .filter((m) => m.bedrijven.includes(bedrijf))
    .sort((a, b) => a.voornaam.localeCompare(b.voornaam));
}

async function _fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  const json = await shiftbaseFetch<ShiftTemplatesApiResponse>("/shifts", { limit: "500" });
  return json.data
    .filter((s) => !s.Shift.deleted && !s.Shift.is_task)
    .map((s) => ({
      id: s.Shift.id,
      bedrijf: BEDRIJF_VAN_DEPARTMENT[s.Shift.department_id] as Bedrijf,
      korteNaam: s.Shift.name,
      langeNaam: s.Shift.long_name || s.Shift.name,
      start: tijdNaarHHMM(s.Shift.starttime),
      eind: tijdNaarHHMM(s.Shift.endtime),
      pauze: typeof s.Shift.break === "string" ? parseInt(s.Shift.break, 10) : s.Shift.break,
      kleur: s.Shift.color,
    }))
    .filter((s) => s.bedrijf !== undefined);
}

export const fetchShiftTemplates = unstable_cache(
  _fetchShiftTemplates,
  ["shiftbase-shift-templates"],
  { revalidate: 600, tags: ["shiftbase", "shiftbase-templates"] },
);

export async function shiftTemplatesPerBedrijf(bedrijf: Bedrijf): Promise<ShiftTemplate[]> {
  const alle = await fetchShiftTemplates();
  return alle
    .filter((s) => s.bedrijf === bedrijf)
    .sort((a, b) => a.start.localeCompare(b.start));
}

// --- Schrijf-helpers --------------------------------------------------------

async function shiftbaseMutate(
  method: "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${SHIFTBASE_BASE}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `API ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shiftbase ${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

// Roster CRUD

export interface NieuweDienst {
  bedrijf: Bedrijf;
  userId: string;
  datum: string;          // YYYY-MM-DD
  start: string;          // HH:MM
  eind: string;           // HH:MM
  shiftTemplateId?: string;
  pauzeMin?: number;
  notitie?: string;
  gepubliceerd?: boolean;
}

function uurNaarSeconden(hhmm: string): string {
  return /^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : hhmm;
}

export async function createRoster(data: NieuweDienst): Promise<{ id: string }> {
  const teamId = TEAM_ID[data.bedrijf];
  const deptId = DEPARTMENT_ID[data.bedrijf];

  const payload = {
    Roster: {
      account_id: "95253",
      department_id: deptId,
      team_id: teamId,
      user_id: data.userId,
      shift_id: data.shiftTemplateId ?? null,
      date: data.datum,
      starttime: uurNaarSeconden(data.start),
      endtime: uurNaarSeconden(data.eind),
      break: String(data.pauzeMin ?? 0),
      description: data.notitie ?? "",
      published: data.gepubliceerd ?? false,
    },
  };
  const resp = (await shiftbaseMutate("POST", "/rosters", payload)) as {
    data?: { Roster?: { id?: string } };
  };
  return { id: resp.data?.Roster?.id ?? "" };
}

export async function updateRoster(
  id: string,
  patch: Partial<NieuweDienst> & { bedrijf: Bedrijf },
): Promise<void> {
  const teamId = TEAM_ID[patch.bedrijf];
  const deptId = DEPARTMENT_ID[patch.bedrijf];

  const payload = {
    Roster: {
      id,
      department_id: deptId,
      team_id: teamId,
      ...(patch.userId        ? { user_id: patch.userId } : {}),
      ...(patch.shiftTemplateId !== undefined ? { shift_id: patch.shiftTemplateId } : {}),
      ...(patch.datum         ? { date: patch.datum } : {}),
      ...(patch.start         ? { starttime: uurNaarSeconden(patch.start) } : {}),
      ...(patch.eind          ? { endtime: uurNaarSeconden(patch.eind) } : {}),
      ...(patch.pauzeMin !== undefined ? { break: String(patch.pauzeMin) } : {}),
      ...(patch.notitie !== undefined ? { description: patch.notitie } : {}),
      ...(patch.gepubliceerd !== undefined ? { published: patch.gepubliceerd } : {}),
    },
  };
  await shiftbaseMutate("PUT", `/rosters/${id}`, payload);
}

export async function deleteRoster(id: string): Promise<void> {
  await shiftbaseMutate("DELETE", `/rosters/${id}`);
}

// Publiceer alle ongepubliceerde diensten voor een week (concept → publiek)
export async function publiceerWeek(bedrijf: Bedrijf, startDatum: string, eindDatum: string): Promise<number> {
  const alle = await fetchDienstenInRange(startDatum, eindDatum);
  const concepten = alle.filter((d) => d.bedrijf === bedrijf && !d.gepubliceerd);
  for (const d of concepten) {
    await updateRoster(d.id, { bedrijf, gepubliceerd: true });
  }
  return concepten.length;
}

// User CRUD

export interface NieuweMedewerker {
  bedrijf: Bedrijf;
  voornaam: string;
  achternaam: string;
  email: string;
  startdatum?: string;     // YYYY-MM-DD
}

export async function createMedewerker(data: NieuweMedewerker): Promise<{ id: string }> {
  const teamId = TEAM_ID[data.bedrijf];
  const payload = {
    User: {
      first_name: data.voornaam,
      last_name: data.achternaam,
      email: data.email,
      startdate: data.startdatum ?? new Intl.DateTimeFormat("sv-SE").format(new Date()),
      locale: "nl-NL",
    },
    Team: [{ id: teamId }],
  };
  const resp = (await shiftbaseMutate("POST", "/users", payload)) as {
    data?: { User?: { id?: string } };
  };
  return { id: resp.data?.User?.id ?? "" };
}

export interface MedewerkerPatch {
  voornaam?: string;
  achternaam?: string;
  email?: string;
  startdatum?: string;
  einddatum?: string | null;
}

export async function updateMedewerker(id: string, patch: MedewerkerPatch): Promise<void> {
  const payload = {
    User: {
      id,
      ...(patch.voornaam   !== undefined ? { first_name: patch.voornaam } : {}),
      ...(patch.achternaam !== undefined ? { last_name:  patch.achternaam } : {}),
      ...(patch.email      !== undefined ? { email: patch.email } : {}),
      ...(patch.startdatum !== undefined ? { startdate: patch.startdatum } : {}),
      ...(patch.einddatum  !== undefined ? { enddate: patch.einddatum } : {}),
    },
  };
  await shiftbaseMutate("PUT", `/users/${id}`, payload);
}

export async function deleteMedewerker(id: string): Promise<void> {
  // Shiftbase: "verwijder" = enddate vandaag zetten (echte delete bestaat alleen
  // voor users zonder historie). Voor zekerheid eerst soft-delete via enddate.
  const vandaag = new Intl.DateTimeFormat("sv-SE").format(new Date());
  try {
    await shiftbaseMutate("PUT", `/users/${id}`, { User: { id, enddate: vandaag } });
  } catch {
    await shiftbaseMutate("DELETE", `/users/${id}`);
  }
}

// --- Cache-invalidatie helper ----------------------------------------------

export const SHIFTBASE_TAGS = ["shiftbase", "shiftbase-medewerkers", "shiftbase-templates"] as const;
