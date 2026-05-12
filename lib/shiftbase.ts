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

  return json.data
    .map(mapRoster)
    .filter((d): d is Dienst => d !== null && d.gepubliceerd);
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

// Diensten van vandaag voor één bedrijf (gepubliceerd)
export async function dienstenVandaag(bedrijf: Bedrijf): Promise<Dienst[]> {
  const vandaag = vandaagISO();
  const alle = await fetchDienstenInRange(vandaag, vandaag);
  return alle
    .filter((d) => d.bedrijf === bedrijf)
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
  return groepeerPerDag(alle, bedrijf);
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
  const gegroepeerd = groepeerPerDag(alle, bedrijf);

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
  const gegroepeerd = groepeerPerDag(alle, bedrijf);

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
