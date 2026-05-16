/**
 * Historisch bezettingsadvies.
 *
 * Vervangt de hardcoded drukte→template logica uit components/BezettingAdvies.tsx
 * door een data-gedreven advies:
 *   "Op vergelijkbare dagen in het verleden stonden er meestal N mensen
 *    bij ongeveer dezelfde omzet — daarom advies N voor vandaag."
 *
 * Vergelijkbaarheids-criteria (in volgorde van strengheid):
 *   1. Zelfde weekdag (verplicht — maandag-gedrag ≠ zaterdag-gedrag)
 *   2. Seizoens-afstand ≤ 6 weken (verplicht — winter ≠ zomer)
 *   3. Omzet binnen ±25% van de verwachting (versoepelt tot ±40% bij <4 hits,
 *      laat dan helemaal vallen bij <3 hits — beter een ruwe match dan niks)
 *
 * Output is null als er geen werkbare historie is (nieuwe vestiging zonder
 * Shiftbase-import, of <3 matches zelfs na alle versoepeling). UI valt dan
 * terug op de oude template-logica.
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { DagOmzet } from "./analytics";

export interface VergelijkbareDag {
  datum: string;       // YYYY-MM-DD
  weekdag: number;     // 0=zo .. 6=za
  aantalMensen: number;
  totaalUren: number;
  omzet: number;
}

export interface HistorischAdvies {
  /** Aanbevolen aantal mensen (mediaan over vergelijkbare dagen). */
  aanbevolenMensen: number;
  /** Aantal vergelijkbare dagen dat tot dit advies leidde. */
  aantalDagen: number;
  /** P25 en P75 van mensen-tellingen — geeft spreiding aan. */
  p25Mensen: number;
  p75Mensen: number;
  /** Mediaan-uren (totaal personeelsuren) over vergelijkbare dagen. */
  mediaanUren: number;
  /** Mediaan-omzet over vergelijkbare dagen, voor sanity-check. */
  mediaanOmzet: number;
  /** De daadwerkelijk gebruikte vergelijkbare dagen (recentste eerst, max 12). */
  vergelijkbareDagen: VergelijkbareDag[];
  /** Welk omzet-filter is uiteindelijk toegepast (mag null zijn = geen). */
  omzetFilterMarge: number | null;
}

const SEIZOEN_AFWIJKING_DAGEN = 42; // ±6 weken
const OMZET_MARGE_STRIKT = 0.25;     // ±25%
const OMZET_MARGE_RUIM = 0.40;       // ±40%

function weekdagVan(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dagInJaar(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const start = Date.UTC(y, 0, 0);
  const huidig = Date.UTC(y, m - 1, d);
  return Math.round((huidig - start) / 86400000);
}

/**
 * Hoever ligt datum A van datum B in het kalenderjaar — rekenend over de
 * jaargrens heen. 1 januari en 31 december zijn 1 dag uit elkaar, niet 364.
 */
function seizoensAfstand(a: string, b: string): number {
  const dagA = dagInJaar(a);
  const dagB = dagInJaar(b);
  const direct = Math.abs(dagA - dagB);
  const overGrens = 365 - direct;
  return Math.min(direct, overGrens);
}

function mediaan(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function percentiel(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((x, y) => x - y);
  const idx = Math.min(s.length - 1, Math.floor(s.length * p));
  return s[idx];
}

export async function historischeBezetting(
  deptSlug: string,
  doelDatum: string,           // YYYY-MM-DD (meestal vandaag)
  verwachteOmzet: number,
  dagOmzet: DagOmzet[],         // alle beschikbare omzet-historie van dit dept
): Promise<HistorischAdvies | null> {
  // 1. Dept_id ophalen
  const [dept] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, deptSlug));
  if (!dept) return null;

  // 2. Alle historische rosters (alleen verleden) — we filteren in JS verder
  //    omdat seizoens-afstand niet trivieel in SQL is.
  const eenJaarTerug = new Date(doelDatum);
  eenJaarTerug.setUTCDate(eenJaarTerug.getUTCDate() - 400);
  const eenJaarTerugIso = eenJaarTerug.toISOString().slice(0, 10);

  const rosters = await db
    .select({
      datum: schema.rosters.datum,
      medewerkerId: schema.rosters.medewerkerId,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      pauzeMin: schema.rosters.pauzeMin,
    })
    .from(schema.rosters)
    .where(and(
      eq(schema.rosters.departmentId, dept.id),
      gte(schema.rosters.datum, eenJaarTerugIso),
      lt(schema.rosters.datum, doelDatum),
    ));

  if (rosters.length === 0) return null;

  // 3. Group per dag: aantal unieke mensen + totaal uren
  const perDag = new Map<string, { mensen: Set<number>; totaalMin: number }>();
  for (const r of rosters) {
    const entry = perDag.get(r.datum) ?? { mensen: new Set<number>(), totaalMin: 0 };
    entry.mensen.add(r.medewerkerId);
    // Diensturen = einde - start - pauze (in minuten). Negatieve = nachtdienst,
    // negeren (komt bij ons niet voor in horeca-rooster).
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.eind.split(":").map(Number);
    const min = (eh * 60 + em) - (sh * 60 + sm) - (r.pauzeMin ?? 0);
    if (min > 0) entry.totaalMin += min;
    perDag.set(r.datum, entry);
  }

  // 4. Omzet-lookup
  const omzetMap = new Map<string, number>();
  for (const d of dagOmzet) omzetMap.set(d.datum, d.omzet);

  // 5. Combineer + filter op weekdag + seizoen
  const doelWeekdag = weekdagVan(doelDatum);
  const grof: VergelijkbareDag[] = [];
  for (const [datum, info] of Array.from(perDag.entries())) {
    if (weekdagVan(datum) !== doelWeekdag) continue;
    if (seizoensAfstand(datum, doelDatum) > SEIZOEN_AFWIJKING_DAGEN) continue;
    if (info.mensen.size === 0) continue;
    grof.push({
      datum,
      weekdag: doelWeekdag,
      aantalMensen: info.mensen.size,
      totaalUren: Math.round((info.totaalMin / 60) * 10) / 10,
      omzet: omzetMap.get(datum) ?? 0,
    });
  }

  if (grof.length === 0) return null;

  // 6. Probeer omzet-filter strikt → ruim → uit
  let geselecteerd: VergelijkbareDag[] = [];
  let omzetMarge: number | null = null;

  if (verwachteOmzet > 0) {
    const strikt = grof.filter((d) => {
      if (d.omzet === 0) return false; // geen omzet-data = niet bruikbaar voor matching
      const diff = Math.abs(d.omzet - verwachteOmzet) / verwachteOmzet;
      return diff <= OMZET_MARGE_STRIKT;
    });
    if (strikt.length >= 4) {
      geselecteerd = strikt;
      omzetMarge = OMZET_MARGE_STRIKT;
    } else {
      const ruim = grof.filter((d) => {
        if (d.omzet === 0) return false;
        const diff = Math.abs(d.omzet - verwachteOmzet) / verwachteOmzet;
        return diff <= OMZET_MARGE_RUIM;
      });
      if (ruim.length >= 3) {
        geselecteerd = ruim;
        omzetMarge = OMZET_MARGE_RUIM;
      }
    }
  }

  // Als omzet-filter onbruikbaar is (geen verwachting, of te weinig matches)
  // → val terug op alleen weekdag + seizoen
  if (geselecteerd.length === 0) {
    if (grof.length < 3) return null;
    geselecteerd = grof;
    omzetMarge = null;
  }

  // 7. Statistiek
  const mensenLijst = geselecteerd.map((d) => d.aantalMensen);
  const urenLijst = geselecteerd.map((d) => d.totaalUren);
  const omzetLijst = geselecteerd.map((d) => d.omzet).filter((o) => o > 0);

  // Recentste eerst, beperken tot 12 voor UI
  geselecteerd.sort((a, b) => b.datum.localeCompare(a.datum));
  const top = geselecteerd.slice(0, 12);

  return {
    aanbevolenMensen: Math.round(mediaan(mensenLijst)),
    aantalDagen: geselecteerd.length,
    p25Mensen: percentiel(mensenLijst, 0.25),
    p75Mensen: percentiel(mensenLijst, 0.75),
    mediaanUren: mediaan(urenLijst),
    mediaanOmzet: mediaan(omzetLijst),
    vergelijkbareDagen: top,
    omzetFilterMarge: omzetMarge,
  };
}
