/**
 * Cashflow-projectie per bedrijf, voor X dagen vooruit.
 *
 * Combineert:
 *  - Huidig bank-saldo (handmatig door owner ingesteld)
 *  - Verwachte omzet uit prognose (per dag)
 *  - Geplande loonkost uit rosters × uurlonen × werkgeverslast-factor
 *  - Vaste lasten gemiddeld uit afgelopen 3 maanden (huur, energie, telecom, etc.)
 *  - Kwartaal BTW-deadlines (1 mei / 1 aug / 1 nov / 1 feb voor Q1/Q2/Q3/Q4)
 *
 * Output: lijst van events met datum, mutatie, saldo-na — zodat de UI er
 * een lijngrafiek + event-lijst van kan maken.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "./db/client";
import { haalIngOp } from "./boekhouding-kv";

export type BedrijfSlug = "bb" | "sl" | "kl";

export interface CashflowEvent {
  datum: string;          // YYYY-MM-DD
  type: "omzet" | "loon" | "vaste_lasten" | "btw" | "factuur" | "overig";
  omschrijving: string;
  mutatie: number;        // positief = inkomend, negatief = uitgaand
  saldoNa: number;
}

export interface CashflowProjectie {
  bedrijf: BedrijfSlug;
  startDatum: string;
  events: CashflowEvent[];
  /**
   * Per dag een snapshot — `saldo` is hier de cumulatieve delta vanaf 0,
   * NIET een absoluut bank-saldo. We laten de naam staan voor de grafiek-
   * code; alleen de UI-labels veranderen naar "cumulatief netto".
   */
  dagen: Array<{ datum: string; saldo: number; mutatie: number }>;
  /** Dagen waarop de cumulatieve delta onder 0 zakt — waarschuwing. */
  gevarenDagen: string[];
  eindDelta: number;
  laagsteDelta: number;
  laagsteDatum: string;
}

const NL_TZ = "Europe/Amsterdam";

function nlDatumString(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: NL_TZ }).format(d);
}

function nlDatumPlusDagen(start: string, dagen: number): string {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return nlDatumString(d);
}

function weekdagVan(datum: string): number {
  return new Date(`${datum}T12:00:00Z`).getUTCDay(); // 0 = zo, 1 = ma, ..., 6 = za
}

/**
 * Vaste-lasten kalender. Eenvoudig: maandelijks op 1e van de maand pakken we
 * het gemiddelde uit de laatste 3 afgesloten maanden voor categorie-typen die
 * recurrent zijn. Categorieën als levensmiddelen tellen NIET als vaste lasten
 * (variabel).
 */
const VASTE_LAST_CATEGORIEEN = new Set([
  "huur", "telecom", "software", "verzekering", "energie", "pensioen",
  "sociale-lasten", "bankkosten", "markthal", "abonnement", "hosting",
]);

async function gemiddeldeVasteLasten(bedrijf: BedrijfSlug, jaar: number): Promise<number> {
  // Gebruik vorige 3 afgesloten maanden t.o.v. nu
  const nu = new Date();
  const huidigeMaand = nu.getMonth() + 1;
  const huidigJaar = nu.getFullYear();

  // Pak maanden N-3, N-2, N-1
  const maanden: Array<{ jaar: number; maand: number }> = [];
  for (let offset = 3; offset >= 1; offset--) {
    let m = huidigeMaand - offset;
    let j = huidigJaar;
    if (m <= 0) { m += 12; j -= 1; }
    maanden.push({ jaar: j, maand: m });
  }

  let totaal = 0;
  let geteldMaanden = 0;
  for (const { jaar: j, maand } of maanden) {
    const txs = await haalIngOp(bedrijf, j, [maand]);
    const maandKost = txs
      .filter((t) => t.richting === "debit" && VASTE_LAST_CATEGORIEEN.has(t.categorie))
      .reduce((s, t) => s + t.bedrag, 0);
    if (maandKost > 0) {
      totaal += maandKost;
      geteldMaanden += 1;
    }
  }

  // Vermijd gebruiken van `jaar`-parameter in een unused-warning
  void jaar;

  return geteldMaanden > 0 ? totaal / geteldMaanden : 0;
}

/**
 * Geplande loonkost per dag voor de komende `dagen` dagen — op basis van
 * rosters × uurloon × (1 + vakantiegeld + verlof + werkgeverslast-pct).
 */
async function plandeLoonPerDag(
  bedrijf: BedrijfSlug,
  startDatum: string,
  dagen: number,
  werkgeverslastenPct: number,
): Promise<Map<string, number>> {
  const eindDatum = nlDatumPlusDagen(startDatum, dagen);
  const [{ id: deptId } = { id: -1 }] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, bedrijf));
  if (deptId === -1) return new Map();

  const rosterRijen = await db
    .select({
      datum: schema.rosters.datum,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      pauzeMin: schema.rosters.pauzeMin,
      uurloon: schema.medewerkers.uurloon,
    })
    .from(schema.rosters)
    .innerJoin(schema.medewerkers, eq(schema.rosters.medewerkerId, schema.medewerkers.id))
    .where(and(
      eq(schema.rosters.departmentId, deptId),
      gte(schema.rosters.datum, startDatum),
      lte(schema.rosters.datum, eindDatum),
    ));

  const opslagFactor = 1 + 0.0833 + 0.08 + werkgeverslastenPct / 100;
  const perDag = new Map<string, number>();
  for (const r of rosterRijen) {
    const uurloon = r.uurloon === null ? 0 : Number(r.uurloon);
    if (uurloon === 0) continue;
    const [sh, sm] = String(r.start).slice(0, 5).split(":").map(Number);
    const [eh, em] = String(r.eind).slice(0, 5).split(":").map(Number);
    const minuten = (eh * 60 + em) - (sh * 60 + sm) - (r.pauzeMin ?? 0);
    if (minuten <= 0) continue;
    const uren = minuten / 60;
    const kost = uren * uurloon * opslagFactor;
    perDag.set(r.datum, (perDag.get(r.datum) ?? 0) + kost);
  }
  return perDag;
}

/**
 * BTW-deadlines voor de komende periode. Kwartaal-aangifte moet in NL op de
 * laatste dag van de maand erna binnen. Eenvoudige benadering: 1e van de
 * maand erop pakken we de BTW-mutatie. Bedrag schatten we op basis van
 * gemiddeld omzet × 9% van afgelopen 3 maanden.
 */
function btwDeadlines(startDatum: string, dagen: number): Array<{ datum: string; kwartaal: number }> {
  const result: Array<{ datum: string; kwartaal: number }> = [];
  // Q1 deadline: 30 april, Q2: 31 juli, Q3: 31 oktober, Q4: 31 januari
  const deadlines = [
    { maand: 4, dag: 30, kwartaal: 1 },
    { maand: 7, dag: 31, kwartaal: 2 },
    { maand: 10, dag: 31, kwartaal: 3 },
    { maand: 1, dag: 31, kwartaal: 4 }, // Q4 over het vorige jaar
  ];
  const jaarHuidig = Number(startDatum.slice(0, 4));
  const eindDatum = nlDatumPlusDagen(startDatum, dagen);
  for (const j of [jaarHuidig, jaarHuidig + 1]) {
    for (const dl of deadlines) {
      const d = `${j}-${String(dl.maand).padStart(2, "0")}-${String(dl.dag).padStart(2, "0")}`;
      if (d >= startDatum && d <= eindDatum) {
        result.push({ datum: d, kwartaal: dl.kwartaal });
      }
    }
  }
  return result;
}

export async function cashflowProjectie(
  bedrijf: BedrijfSlug,
  dagen = 90,
): Promise<CashflowProjectie> {
  // 1. Bedrijfsinstellingen — werkgeverslasten-pct (was: ook startsaldo)
  // Bank-saldo is uit de UI gehaald omdat handmatig bijhouden te foutgevoelig
  // bleek. De projectie toont nu de cumulatieve netto-delta vanaf 0.
  const [dept] = await db
    .select({
      werkgeverslastenPct: schema.departments.werkgeverslastenPct,
    })
    .from(schema.departments)
    .where(eq(schema.departments.slug, bedrijf));

  const startSaldo = 0;
  const werkgeverslastenPct = dept?.werkgeverslastenPct === null || dept?.werkgeverslastenPct === undefined
    ? 27
    : Number(dept.werkgeverslastenPct);

  const startDatum = nlDatumString(new Date());

  // 2. Verwachte omzet per dag — uit huidige maand-prognose (fallback:
  // gem. omzet × 0.92 voor risico-marge). We doen het simpel: lees recente
  // ING-credits met categorie omzet, neem gemiddelde, deel uit per dag.
  const huidigJaar = Number(startDatum.slice(0, 4));
  const huidigeMaand = Number(startDatum.slice(5, 7));
  const recenteOmzetTxs = await haalIngOp(bedrijf, huidigJaar, [
    Math.max(1, huidigeMaand - 2),
    Math.max(1, huidigeMaand - 1),
    huidigeMaand,
  ]);
  const omzetCredits = recenteOmzetTxs.filter((t) => t.richting === "credit" && t.categorie === "omzet");
  const dagenInPeriode = 90; // ~3 maanden
  const omzetPerDagGem = omzetCredits.reduce((s, t) => s + t.bedrag, 0) / dagenInPeriode;

  // 3. Loon per dag (uit rosters)
  const loonPerDag = await plandeLoonPerDag(bedrijf, startDatum, dagen, werkgeverslastenPct);

  // 4. Vaste lasten — gemiddeld per maand, verschijnt op de 1e
  const vasteLastenMaand = await gemiddeldeVasteLasten(bedrijf, huidigJaar);

  // 5. BTW-deadlines
  const btw = btwDeadlines(startDatum, dagen);

  // 6. Bouw events
  const events: CashflowEvent[] = [];
  let saldo = startSaldo;

  for (let i = 0; i < dagen; i++) {
    const datum = nlDatumPlusDagen(startDatum, i);

    // Inkomende omzet: niet op zondag (meestal dicht) en zaterdag 1.4× hoger
    const dow = weekdagVan(datum);
    let omzetFactor = 1.0;
    if (dow === 0) omzetFactor = 0.6;        // zo
    else if (dow === 5) omzetFactor = 1.25;  // vr
    else if (dow === 6) omzetFactor = 1.40;  // za
    const omzetDag = omzetPerDagGem * omzetFactor;
    if (omzetDag > 1) {
      saldo += omzetDag;
      events.push({
        datum, type: "omzet",
        omschrijving: "Verwachte omzet (model-prognose)",
        mutatie: omzetDag,
        saldoNa: saldo,
      });
    }

    // Loon: shifts van deze dag
    const loon = loonPerDag.get(datum) ?? 0;
    if (loon > 0) {
      saldo -= loon;
      events.push({
        datum, type: "loon",
        omschrijving: "Geplande loonkost (rooster × all-in)",
        mutatie: -loon,
        saldoNa: saldo,
      });
    }

    // Vaste lasten: 1e van de maand
    if (datum.endsWith("-01") && vasteLastenMaand > 0) {
      saldo -= vasteLastenMaand;
      events.push({
        datum, type: "vaste_lasten",
        omschrijving: "Vaste lasten (huur/energie/telecom/etc. — gem. 3 mnd)",
        mutatie: -vasteLastenMaand,
        saldoNa: saldo,
      });
    }

    // BTW-deadlines
    const btwDeadline = btw.find((b) => b.datum === datum);
    if (btwDeadline) {
      // Schatting BTW = omzet × 9% van vorige 3 maanden (gewone aanname)
      // Zonder voorbelasting omdat dat onbekend is voor toekomstige periodes.
      const btwBedrag = omzetPerDagGem * 90 * 0.09 * 0.7; // ~70% van bruto-omzet × 9% (voorbelasting compenseert deels)
      if (btwBedrag > 0) {
        saldo -= btwBedrag;
        events.push({
          datum, type: "btw",
          omschrijving: `BTW-aangifte Q${btwDeadline.kwartaal}`,
          mutatie: -btwBedrag,
          saldoNa: saldo,
        });
      }
    }
  }

  // 7. Dag-saldo snapshots (één per dag, niet per event)
  const dagSaldoMap = new Map<string, { saldo: number; mutatie: number }>();
  let lopendSaldo = startSaldo;
  for (let i = 0; i < dagen; i++) {
    const datum = nlDatumPlusDagen(startDatum, i);
    const dagEvents = events.filter((e) => e.datum === datum);
    const dagMutatie = dagEvents.reduce((s, e) => s + e.mutatie, 0);
    lopendSaldo += dagMutatie;
    dagSaldoMap.set(datum, { saldo: lopendSaldo, mutatie: dagMutatie });
  }
  const dagenLijst = Array.from(dagSaldoMap.entries()).map(([datum, v]) => ({
    datum, saldo: Math.round(v.saldo * 100) / 100, mutatie: Math.round(v.mutatie * 100) / 100,
  }));

  // 8. Gevarenzones: dagen waarop de cumulatieve delta onder 0 zakt.
  // Zonder absolute saldo kunnen we niet meer relatief aan een startwaarde
  // waarschuwen; we vlaggen dus elke dag met negatief cumulatief.
  const gevarenDagen = dagenLijst
    .filter((d) => d.saldo < 0)
    .map((d) => d.datum);

  // 9. Laagste delta + datum
  const laagste = dagenLijst.reduce(
    (acc, d) => (d.saldo < acc.saldo ? { saldo: d.saldo, datum: d.datum } : acc),
    { saldo: 0, datum: startDatum },
  );

  const eindDelta = dagenLijst[dagenLijst.length - 1]?.saldo ?? 0;

  return {
    bedrijf,
    startDatum,
    events: events.map((e) => ({ ...e, mutatie: Math.round(e.mutatie * 100) / 100, saldoNa: Math.round(e.saldoNa * 100) / 100 })),
    dagen: dagenLijst,
    gevarenDagen,
    eindDelta: Math.round(eindDelta * 100) / 100,
    laagsteDelta: Math.round(laagste.saldo * 100) / 100,
    laagsteDatum: laagste.datum,
  };
}
