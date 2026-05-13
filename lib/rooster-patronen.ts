/**
 * Rooster-patronen — leert van historische gepubliceerde diensten.
 *
 * Doel: de AI-roosteragent context geven over hoe een medewerker
 * doorgaans werkt. Door deze "stille kennis" zichtbaar te maken kan de AI
 * sneller een rooster maken dat aansluit bij wat al werkt in de praktijk.
 *
 * Output per medewerker (voor 1 bedrijf):
 * - vasteWeekdagen: dagen waarop deze persoon vaker werkt dan gemiddeld
 * - typischeStart / typischeEind: meest voorkomende shift-tijden
 * - vasteCollegas: medewerkers waarmee deze persoon vaak samenwerkt
 * - aantalDiensten: hoeveelheid data waarop dit gebaseerd is
 *
 * Bron: gepubliceerde rosters in eigen DB (na de Shiftbase-migratie zit
 * daar ~1 jaar in). Concept-diensten tellen niet mee.
 */

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { Bedrijf } from "./sumup";

export interface MedewerkerPatroon {
  medewerkerId: string;
  voornaam: string;
  achternaam: string;
  aantalDiensten: number;
  // 7 booleans: zo, ma, di, wo, do, vr, za — true als > drempel keer gewerkt op die dag
  vasteWeekdagen: boolean[];
  // Per weekdag: aantal historische diensten (voor uitleg in prompt)
  weekdagFrequentie: number[];
  typischeStart: string | null;   // HH:MM (modus)
  typischeEind: string | null;
  gemiddeldeUren: number;
  // Top-3 collega's waar ze het vaakst mee samenwerken
  vasteCollegas: Array<{ naam: string; aantalSamen: number }>;
}

/**
 * Helper: pak HH:MM uit een time-string (kan HH:MM of HH:MM:SS zijn).
 */
function hhmm(t: string): string {
  return t.slice(0, 5);
}

/**
 * Helper: modus (meest voorkomende waarde) uit een lijst strings.
 */
function modus(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const tellingen = new Map<string, number>();
  for (const v of arr) tellingen.set(v, (tellingen.get(v) ?? 0) + 1);
  let beste: { v: string; n: number } | null = null;
  for (const [v, n] of Array.from(tellingen.entries())) {
    if (!beste || n > beste.n) beste = { v, n };
  }
  return beste?.v ?? null;
}

/**
 * Bereken patronen voor alle actieve medewerkers van een bedrijf op basis van
 * gepubliceerde diensten in de afgelopen `dagenTerug` dagen.
 */
export async function patronenVoorBedrijf(
  bedrijf: Bedrijf,
  dagenTerug = 365,
): Promise<MedewerkerPatroon[]> {
  const grens = new Date();
  grens.setDate(grens.getDate() - dagenTerug);
  const grensIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(grens);
  const vandaag = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(new Date());

  // Department-id ophalen
  const dept = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, bedrijf));
  if (!dept[0]) return [];
  const deptId = dept[0].id;

  // Alle gepubliceerde diensten in de range
  const rows = await db
    .select({
      medewerkerId: schema.rosters.medewerkerId,
      datum: schema.rosters.datum,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      pauzeMin: schema.rosters.pauzeMin,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
    })
    .from(schema.rosters)
    .innerJoin(schema.medewerkers, eq(schema.rosters.medewerkerId, schema.medewerkers.id))
    .where(and(
      eq(schema.rosters.departmentId, deptId),
      eq(schema.rosters.gepubliceerd, true),
      gte(schema.rosters.datum, grensIso),
      lte(schema.rosters.datum, vandaag),
    ));

  // Groepeer per medewerker
  type RowsPerMedewerker = {
    voornaam: string;
    achternaam: string;
    rows: typeof rows;
  };
  const perMedewerker = new Map<number, RowsPerMedewerker>();
  for (const r of rows) {
    const cur = perMedewerker.get(r.medewerkerId) ?? {
      voornaam: r.voornaam,
      achternaam: r.achternaam,
      rows: [] as typeof rows,
    };
    cur.rows.push(r);
    perMedewerker.set(r.medewerkerId, cur);
  }

  // Bouw lookup: per dag, welke medewerkers werkten samen?
  // datum → set medewerkerIds
  const datumNaarMedewerkers = new Map<string, Set<number>>();
  for (const r of rows) {
    const set = datumNaarMedewerkers.get(r.datum) ?? new Set();
    set.add(r.medewerkerId);
    datumNaarMedewerkers.set(r.datum, set);
  }

  // ID → "voornaam achternaam" voor leesbaarheid in output
  const naamLookup = new Map<number, string>();
  for (const [id, v] of Array.from(perMedewerker.entries())) {
    naamLookup.set(id, `${v.voornaam} ${v.achternaam}`);
  }

  const resultaten: MedewerkerPatroon[] = [];

  for (const [medewerkerId, v] of Array.from(perMedewerker.entries())) {
    if (v.rows.length < 4) continue; // Te weinig data om patronen uit te halen

    // Weekdag-frequentie (0=zo..6=za)
    const weekdagFrequentie = [0, 0, 0, 0, 0, 0, 0];
    for (const r of v.rows) {
      const [y, m, d] = r.datum.split("-").map(Number);
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      weekdagFrequentie[wd]++;
    }
    // Drempel: een dag is "vast" als hij > 1.5× gemiddeld voorkomt
    const gem = v.rows.length / 7;
    const drempel = gem * 1.5;
    const vasteWeekdagen = weekdagFrequentie.map((n) => n > drempel);

    // Typische start/eind (modus van HH:MM)
    const typischeStart = modus(v.rows.map((r) => hhmm(r.start)));
    const typischeEind  = modus(v.rows.map((r) => hhmm(r.eind)));

    // Gemiddelde uren per dienst
    const totaalUren = v.rows.reduce((s, r) => {
      const [sh, sm] = r.start.split(":").map(Number);
      const [eh, em] = r.eind.split(":").map(Number);
      const min = Math.max(0, eh * 60 + em - sh * 60 - sm - (r.pauzeMin ?? 0));
      return s + min / 60;
    }, 0);
    const gemiddeldeUren = Math.round((totaalUren / v.rows.length) * 10) / 10;

    // Vaste collega's — tel hoe vaak deze medewerker dezelfde dag werkte
    // als anderen, top 3
    const collegaTelling = new Map<number, number>();
    for (const r of v.rows) {
      const samen = datumNaarMedewerkers.get(r.datum);
      if (!samen) continue;
      for (const andereId of Array.from(samen)) {
        if (andereId === medewerkerId) continue;
        collegaTelling.set(andereId, (collegaTelling.get(andereId) ?? 0) + 1);
      }
    }
    const vasteCollegas = Array.from(collegaTelling.entries())
      .map(([id, n]) => ({ naam: naamLookup.get(id) ?? `id ${id}`, aantalSamen: n }))
      .sort((a, b) => b.aantalSamen - a.aantalSamen)
      .slice(0, 3);

    resultaten.push({
      medewerkerId: String(medewerkerId),
      voornaam: v.voornaam,
      achternaam: v.achternaam,
      aantalDiensten: v.rows.length,
      vasteWeekdagen,
      weekdagFrequentie,
      typischeStart,
      typischeEind,
      gemiddeldeUren,
      vasteCollegas,
    });
  }

  return resultaten.sort((a, b) => b.aantalDiensten - a.aantalDiensten);
}

/**
 * Compacte tekstuele samenvatting van patronen voor 1 medewerker —
 * geschikt om aan een AI-prompt mee te geven. Houdt het kort (1-2 zinnen)
 * zodat de context-window niet ontploft bij 20+ medewerkers.
 */
export function patroonSamenvatting(p: MedewerkerPatroon): string {
  const DAG_KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const onderdelen: string[] = [];

  const vasteD = p.vasteWeekdagen
    .map((vast, i) => (vast ? DAG_KORT[i] : null))
    .filter((x): x is string => x !== null);
  if (vasteD.length > 0) {
    onderdelen.push(`werkt vaak op ${vasteD.join("/")}`);
  }

  if (p.typischeStart && p.typischeEind) {
    onderdelen.push(`typisch ${p.typischeStart}–${p.typischeEind} (${p.gemiddeldeUren}u gem.)`);
  }

  if (p.vasteCollegas.length > 0) {
    const topNaam = p.vasteCollegas[0].naam.split(" ")[0];
    onderdelen.push(`vaak samen met ${topNaam}`);
  }

  if (onderdelen.length === 0) return `${p.aantalDiensten} historische diensten, geen sterk patroon`;
  return `${p.aantalDiensten} diensten — ${onderdelen.join("; ")}`;
}
