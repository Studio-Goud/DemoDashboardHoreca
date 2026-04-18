import { SumUpTransaction, type Bedrijf } from "./sumup";
import {
  format,
  startOfDay,
  endOfDay,
  parseISO,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
  differenceInCalendarDays,
  differenceInMinutes,
  addDays,
  subYears,
  isSameDay,
} from "date-fns";
import { nl } from "date-fns/locale";
import { OPENINGSUREN, isBinnenOpeningstijden } from "./openingsuren";
import {
  feestdagOpDatum,
  vakantieOpDatum,
  type KomendEvent,
} from "./feestdagen";
import {
  getHoursNL as getHours,
  getDayNL as getDay,
  nlDagKey,
  nlDate,
} from "./tz";
import { drukteVoorOmzet, type DrukLevel } from "./drukte";

export interface DagOmzet {
  datum: string;
  omzet: number;
  aantalTransacties: number;
}

export interface UurData {
  uur: number;
  label: string;
  gemiddeld: number;
  totaal: number;
  aantalDagen: number;
}

export interface ProductData {
  naam: string;
  omzet: number;
  aantal: number;
  gemPrijs: number;
  aandeel: number;          // % van totale productomzet
  trend: number;            // % laatste 30d vs voorgaande 30d
  laatstVerkocht: string | null;
}

export interface Prognose {
  datum: string;
  dagNaam: string;
  verwacht: number;
  druk: DrukLevel;
  weekdag: number;
  feestdag?: string | null;
  vakantie?: string | null;
}

export interface KernCijfers {
  vandaag: PeriodeCijfer;
  gisteren: PeriodeCijfer;
  zelfdeDagVorigeWeek: PeriodeCijfer;
  dezeWeek: PeriodeCijfer;
  vorigeWeek: PeriodeCijfer;
  dezeMaand: PeriodeCijfer;
  vorigeMaandTotNu: PeriodeCijfer;   // zelfde dagnummer vorige maand
  ditJaar: PeriodeCijfer;
  vorigJaarTotNu: PeriodeCijfer;      // YTD vorig jaar
  totaal: PeriodeCijfer;
  gemTxPerDag: number;
  gemOmzetPerDag: number;
  druksteDag: { datum: string; omzet: number } | null;
  rustigsteDag: { datum: string; omzet: number } | null;
  verwachtVandaag: number;            // op basis van gem. zelfde weekdag laatste 8 weken
  resterendVandaag: number;           // verwacht − gerealiseerd
  groei: {
    tovGisteren: number;
    tovZelfdeDagVorigeWeek: number;
    tovVorigeWeek: number;
    tovVorigeMaand: number;
    tovVorigJaar: number;
  };
  laatsteTx: SumUpTransaction | null;
  tijdSindsLaatsteTxMin: number | null;
}

export interface PeriodeCijfer {
  omzet: number;
  txs: number;
  gemBon: number;
  label: string;
}

export interface WeekdagUur {
  weekdag: number;        // 0 = zo
  uur: number;
  gemiddeld: number;
  totaal: number;
  aantalDagen: number;
}

export interface MaandOmzet {
  jaar: number;
  maand: number;          // 1..12
  omzet: number;
  txs: number;
}

const DAG_NAMEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const UREN_LABELS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);

function leeg(label: string): PeriodeCijfer {
  return { omzet: 0, txs: 0, gemBon: 0, label };
}

function sommeer(txs: SumUpTransaction[], label: string): PeriodeCijfer {
  const omzet = txs.reduce((s, t) => s + t.amount, 0);
  return {
    omzet: Math.round(omzet * 100) / 100,
    txs: txs.length,
    gemBon: txs.length > 0 ? Math.round((omzet / txs.length) * 100) / 100 : 0,
    label,
  };
}

function txsInInterval(
  txs: SumUpTransaction[],
  start: Date,
  end: Date
): SumUpTransaction[] {
  return txs.filter((t) => {
    const d = parseISO(t.timestamp);
    return d >= start && d <= end;
  });
}

function groei(huidig: number, vorig: number): number {
  if (vorig <= 0) return huidig > 0 ? 100 : 0;
  return Math.round(((huidig - vorig) / vorig) * 1000) / 10;
}

export function berekenDagOmzet(txs: SumUpTransaction[]): DagOmzet[] {
  const map = new Map<string, { omzet: number; aantal: number }>();

  for (const tx of txs) {
    const dag = nlDagKey(tx.timestamp);
    const bestaand = map.get(dag) ?? { omzet: 0, aantal: 0 };
    map.set(dag, {
      omzet: bestaand.omzet + tx.amount,
      aantal: bestaand.aantal + 1,
    });
  }

  return Array.from(map.entries())
    .map(([datum, data]) => ({
      datum,
      omzet: Math.round(data.omzet * 100) / 100,
      aantalTransacties: data.aantal,
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export function berekenPiekuren(txs: SumUpTransaction[]): UurData[] {
  const uurTotaal = new Array(24).fill(0);
  const uurDagen: Set<string>[] = Array.from({ length: 24 }, () => new Set());

  for (const tx of txs) {
    const dt = parseISO(tx.timestamp);
    const uur = getHours(dt);
    const dag = nlDagKey(dt);
    uurTotaal[uur] += tx.amount;
    uurDagen[uur].add(dag);
  }

  return Array.from({ length: 24 }, (_, i) => ({
    uur: i,
    label: UREN_LABELS[i],
    totaal: Math.round(uurTotaal[i] * 100) / 100,
    aantalDagen: uurDagen[i].size,
    gemiddeld:
      uurDagen[i].size > 0
        ? Math.round((uurTotaal[i] / uurDagen[i].size) * 100) / 100
        : 0,
  }));
}

export function berekenWeekdagUur(txs: SumUpTransaction[]): WeekdagUur[] {
  // 7 × 24 matrix
  const totaal: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const dagenSet: Set<string>[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => new Set())
  );

  for (const tx of txs) {
    const dt = parseISO(tx.timestamp);
    const wd = getDay(dt);
    const uur = getHours(dt);
    const dag = nlDagKey(dt);
    totaal[wd][uur] += tx.amount;
    dagenSet[wd][uur].add(dag);
  }

  const resultaat: WeekdagUur[] = [];
  for (let wd = 0; wd < 7; wd++) {
    for (let u = 0; u < 24; u++) {
      const dagen = dagenSet[wd][u].size;
      resultaat.push({
        weekdag: wd,
        uur: u,
        totaal: Math.round(totaal[wd][u] * 100) / 100,
        gemiddeld:
          dagen > 0 ? Math.round((totaal[wd][u] / dagen) * 100) / 100 : 0,
        aantalDagen: dagen,
      });
    }
  }
  return resultaat;
}

export function berekenMaandOmzet(txs: SumUpTransaction[]): MaandOmzet[] {
  const map = new Map<string, { omzet: number; txs: number }>();
  for (const tx of txs) {
    const dt = nlDate(tx.timestamp);
    const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
    const bestaand = map.get(key) ?? { omzet: 0, txs: 0 };
    bestaand.omzet += tx.amount;
    bestaand.txs += 1;
    map.set(key, bestaand);
  }
  return Array.from(map.entries())
    .map(([k, v]) => {
      const [jaar, maand] = k.split("-").map(Number);
      return {
        jaar,
        maand,
        omzet: Math.round(v.omzet * 100) / 100,
        txs: v.txs,
      };
    })
    .sort((a, b) => (a.jaar - b.jaar) * 100 + (a.maand - b.maand));
}

export function berekenTopProducten(txs: SumUpTransaction[]): ProductData[] {
  const map = new Map<
    string,
    { omzet: number; aantal: number; laatst: string | null; recent: number; prior: number }
  >();

  const nu = new Date();
  const grens30 = subDays(nu, 30);
  const grens60 = subDays(nu, 60);
  const totaalProductOmzet = { val: 0 };

  for (const tx of txs) {
    if (!tx.products) continue;
    const dt = parseISO(tx.timestamp);
    for (const p of tx.products) {
      const bedrag = p.price * p.quantity;
      const bestaand =
        map.get(p.name) ??
        { omzet: 0, aantal: 0, laatst: null as string | null, recent: 0, prior: 0 };
      bestaand.omzet += bedrag;
      bestaand.aantal += p.quantity;
      if (!bestaand.laatst || tx.timestamp > bestaand.laatst)
        bestaand.laatst = tx.timestamp;
      if (dt >= grens30) bestaand.recent += bedrag;
      else if (dt >= grens60) bestaand.prior += bedrag;
      map.set(p.name, bestaand);
      totaalProductOmzet.val += bedrag;
    }
  }

  const totaal = Math.max(totaalProductOmzet.val, 1);

  return Array.from(map.entries())
    .map(([naam, d]) => ({
      naam,
      omzet: Math.round(d.omzet * 100) / 100,
      aantal: d.aantal,
      gemPrijs: d.aantal > 0 ? Math.round((d.omzet / d.aantal) * 100) / 100 : 0,
      aandeel: Math.round((d.omzet / totaal) * 1000) / 10,
      trend: groei(d.recent, d.prior),
      laatstVerkocht: d.laatst,
    }))
    .sort((a, b) => b.omzet - a.omzet);
}

export function berekenPrognose(
  txs: SumUpTransaction[],
  bedrijf: Bedrijf
): Prognose[] {
  // Bouw per-dag omzet map (volledige historie)
  const perDag = new Map<string, number>();
  for (const tx of txs) {
    const dag = nlDagKey(tx.timestamp);
    perDag.set(dag, (perDag.get(dag) ?? 0) + tx.amount);
  }

  const nu = new Date();
  const grens8w = subDays(nu, 56);

  // Gem. per weekdag — laatste 8 weken, excl. feestdagen
  const weekdagOmzetten: number[][] = Array.from({ length: 7 }, () => []);
  for (const [dagKey, omzet] of Array.from(perDag.entries())) {
    const d = parseISO(dagKey);
    if (d < grens8w) continue;
    if (feestdagOpDatum(d)) continue;
    weekdagOmzetten[getDay(d)].push(omzet);
  }
  const weekdagGem = weekdagOmzetten.map((v) =>
    v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0
  );

  const prognoses: Prognose[] = [];
  for (let i = 0; i <= 13; i++) {
    const datum = addDays(startOfDay(nu), i);
    const wd = getDay(datum);
    const feest = feestdagOpDatum(datum);
    const vak = vakantieOpDatum(datum);

    let verwacht = weekdagGem[wd];
    if (feest) {
      const vorigJaar = new Date(
        datum.getFullYear() - 1,
        datum.getMonth(),
        datum.getDate()
      );
      const vorigOmzet = perDag.get(nlDagKey(vorigJaar));
      if (vorigOmzet !== undefined) {
        verwacht = vorigOmzet;
      } else if (feest.impact === "dicht") {
        verwacht = 0;
      }
    }

    const verwachtAfgerond = Math.round(verwacht * 100) / 100;
    const drukLevel: Prognose["druk"] =
      feest?.impact === "dicht" && verwachtAfgerond === 0
        ? "gesloten"
        : drukteVoorOmzet(verwachtAfgerond, bedrijf);

    prognoses.push({
      datum: nlDagKey(datum),
      dagNaam: format(datum, "EEEE d MMM", { locale: nl }),
      verwacht: verwachtAfgerond,
      weekdag: wd,
      feestdag: feest?.naam ?? null,
      vakantie: vak?.naam ?? null,
      druk: drukLevel,
    });
  }

  return prognoses;
}

// Agenda-event verrijkt met verwachte omzet + revenue-gebaseerde drukte
export interface VerrijktEvent extends KomendEvent {
  verwachteOmzet: number | null;
  verwachteOmzetPerDag?: number | null;
  minPerDag?: number | null;
  maxPerDag?: number | null;
  dagenGemeten?: number;
  dagenDrukOfHoger?: number;          // aantal dagen op/boven "druk"-drempel
  bron: "vorig-jaar" | "weekdag-gem" | "dicht" | "onbekend";
  drukte: DrukLevel;
}

export function verrijkEvents(
  events: KomendEvent[],
  txs: SumUpTransaction[],
  bedrijf: Bedrijf
): VerrijktEvent[] {
  // Per-dag omzet-index
  const perDag = new Map<string, number>();
  for (const tx of txs) {
    const d = nlDagKey(tx.timestamp);
    perDag.set(d, (perDag.get(d) ?? 0) + tx.amount);
  }

  // Gem. per weekdag, laatste 8 weken, excl. feestdagen
  const nu = new Date();
  const grens = subDays(nu, 56);
  const weekdagOmzetten: number[][] = Array.from({ length: 7 }, () => []);
  for (const [key, omzet] of Array.from(perDag.entries())) {
    const d = parseISO(key);
    if (d < grens) continue;
    if (feestdagOpDatum(d)) continue;
    weekdagOmzetten[getDay(d)].push(omzet);
  }
  const weekdagGem = weekdagOmzetten.map((v) =>
    v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0
  );

  return events.map((event) => {
    let verwacht: number | null = null;
    let verwachtPerDag: number | null = null;
    let bron: VerrijktEvent["bron"] = "onbekend";

    if (event.soort === "feestdag" || event.soort === "herdenking") {
      if (event.impact === "dicht") {
        verwacht = 0;
        bron = "dicht";
      } else {
        const vorig = subYears(event.datum, 1);
        const vorigOmzet = perDag.get(nlDagKey(vorig));
        if (vorigOmzet !== undefined && vorigOmzet > 0) {
          verwacht = vorigOmzet;
          bron = "vorig-jaar";
        } else {
          const wd = getDay(event.datum);
          verwacht = weekdagGem[wd] > 0 ? weekdagGem[wd] : null;
          bron = verwacht !== null ? "weekdag-gem" : "onbekend";
        }
      }
    } else if (event.soort === "vakantie" && event.range) {
      // Vorige jaar dezelfde vakantie-periode
      const vorigVan = subYears(event.range.van, 1);
      const vorigTot = subYears(event.range.tot, 1);
      let som = 0;
      let dagenMetData = 0;
      let minDag = Infinity;
      let maxDag = -Infinity;
      let drukOfHoger = 0;
      const drempelDruk = bedrijf === "bb" ? 1300 : 900;

      for (
        let d = new Date(vorigVan);
        d <= vorigTot;
        d = addDays(d, 1)
      ) {
        const omzet = perDag.get(nlDagKey(d));
        if (omzet !== undefined) {
          som += omzet;
          dagenMetData++;
          if (omzet < minDag) minDag = omzet;
          if (omzet > maxDag) maxDag = omzet;
          if (omzet >= drempelDruk) drukOfHoger++;
        }
      }
      if (dagenMetData > 0) {
        verwacht = Math.round(som * 100) / 100;
        verwachtPerDag = Math.round((som / dagenMetData) * 100) / 100;
        bron = "vorig-jaar";
      }

      const drukteVakantie: DrukLevel =
        verwachtPerDag !== null
          ? drukteVoorOmzet(verwachtPerDag, bedrijf)
          : "laag";

      return {
        ...event,
        verwachteOmzet:
          verwacht !== null ? Math.round(verwacht * 100) / 100 : null,
        verwachteOmzetPerDag: verwachtPerDag,
        minPerDag: minDag === Infinity ? null : Math.round(minDag * 100) / 100,
        maxPerDag: maxDag === -Infinity ? null : Math.round(maxDag * 100) / 100,
        dagenGemeten: dagenMetData,
        dagenDrukOfHoger: drukOfHoger,
        bron,
        drukte: drukteVakantie,
      };
    }

    const drukte: DrukLevel =
      bron === "dicht"
        ? "gesloten"
        : verwacht !== null
        ? drukteVoorOmzet(verwacht, bedrijf)
        : "laag";

    return {
      ...event,
      verwachteOmzet: verwacht !== null ? Math.round(verwacht * 100) / 100 : null,
      verwachteOmzetPerDag: verwachtPerDag,
      bron,
      drukte,
    };
  });
}

export function berekenWeekdagCurve(
  txs: SumUpTransaction[],
  weekdag: number
): number[] {
  // 24-entry array met gem. omzet per uur voor deze weekdag (laatste 8 weken,
  // alleen binnen openingstijden, feestdagen uitgesloten)
  const nu = new Date();
  const grens = subDays(nu, 56);
  const uren = OPENINGSUREN[weekdag];
  if (!uren) return new Array(24).fill(0);

  const uurTotaal = new Array(24).fill(0);
  const uniekeDagen = new Set<string>();

  for (const tx of txs) {
    const dt = parseISO(tx.timestamp);
    if (dt < grens) continue;
    if (getDay(dt) !== weekdag) continue;
    if (feestdagOpDatum(dt)) continue;
    const uur = getHours(dt);
    // Buiten openingsuren? sla over
    if (uur < uren.open || uur >= uren.close) continue;
    uurTotaal[uur] += tx.amount;
    uniekeDagen.add(nlDagKey(dt));
  }

  const dagen = Math.max(uniekeDagen.size, 1);
  return uurTotaal.map((t) => Math.round((t / dagen) * 100) / 100);
}

export function berekenVerwachtVandaag(txs: SumUpTransaction[]): number {
  const nu = new Date();
  const wdVandaag = getDay(nu);
  const grens = subDays(nu, 56);
  const recent = txs.filter((t) => parseISO(t.timestamp) >= grens);

  const perDag = new Map<string, number>();
  for (const tx of recent) {
    const dag = nlDagKey(tx.timestamp);
    perDag.set(dag, (perDag.get(dag) ?? 0) + tx.amount);
  }

  const zelfdeWd: number[] = [];
  for (const [dag, omzet] of Array.from(perDag.entries())) {
    const wd = getDay(parseISO(dag));
    if (wd === wdVandaag && dag !== format(nu, "yyyy-MM-dd")) {
      zelfdeWd.push(omzet);
    }
  }
  if (zelfdeWd.length === 0) return 0;
  return (
    Math.round(
      (zelfdeWd.reduce((a, b) => a + b, 0) / zelfdeWd.length) * 100
    ) / 100
  );
}

export function berekenKerncijfers(txs: SumUpTransaction[]): KernCijfers {
  const nu = new Date();

  const vandaagStart = startOfDay(nu);
  const vandaagEind = endOfDay(nu);

  const gisterenStart = startOfDay(subDays(nu, 1));
  const gisterenEind = endOfDay(subDays(nu, 1));

  const zelfdeDagVorigeWeekStart = startOfDay(subDays(nu, 7));
  const zelfdeDagVorigeWeekEind = endOfDay(subDays(nu, 7));

  const weekStart = startOfWeek(nu, { weekStartsOn: 1 });
  const weekEind = nu;

  const vorigeWeekStart = startOfWeek(subDays(nu, 7), { weekStartsOn: 1 });
  const vorigeWeekEind = endOfWeek(subDays(nu, 7), { weekStartsOn: 1 });

  const maandStart = startOfMonth(nu);
  const dagInMaand = nu.getDate();

  const vorigeMaandStart = startOfMonth(subDays(maandStart, 1));
  const vorigeMaandTotNuEind = endOfDay(
    addDays(vorigeMaandStart, dagInMaand - 1)
  );

  const jaarStart = startOfYear(nu);
  const vorigJaarStart = startOfYear(subDays(jaarStart, 1));
  const vorigJaarTotNuEind = endOfDay(
    new Date(
      nu.getFullYear() - 1,
      nu.getMonth(),
      Math.min(
        nu.getDate(),
        new Date(nu.getFullYear() - 1, nu.getMonth() + 1, 0).getDate()
      ),
      23,
      59,
      59
    )
  );

  const vandaag = sommeer(
    txsInInterval(txs, vandaagStart, vandaagEind),
    "Vandaag"
  );
  const gisteren = sommeer(
    txsInInterval(txs, gisterenStart, gisterenEind),
    "Gisteren"
  );
  const zelfdeDagVorigeWeek = sommeer(
    txsInInterval(txs, zelfdeDagVorigeWeekStart, zelfdeDagVorigeWeekEind),
    `${format(zelfdeDagVorigeWeekStart, "EEEE", { locale: nl })} vorige week`
  );
  const dezeWeek = sommeer(
    txsInInterval(txs, weekStart, weekEind),
    "Deze week"
  );
  const vorigeWeek = sommeer(
    txsInInterval(txs, vorigeWeekStart, vorigeWeekEind),
    "Vorige week"
  );
  const dezeMaand = sommeer(
    txsInInterval(txs, maandStart, nu),
    format(nu, "MMMM yyyy", { locale: nl })
  );
  const vorigeMaandTotNu = sommeer(
    txsInInterval(txs, vorigeMaandStart, vorigeMaandTotNuEind),
    `${format(vorigeMaandStart, "MMMM", { locale: nl })} (t/m dag ${dagInMaand})`
  );
  const ditJaar = sommeer(
    txsInInterval(txs, jaarStart, nu),
    `${nu.getFullYear()} (YTD)`
  );
  const vorigJaarTotNu = sommeer(
    txsInInterval(txs, vorigJaarStart, vorigJaarTotNuEind),
    `${nu.getFullYear() - 1} (YTD)`
  );
  const totaal = sommeer(txs, "Totaal beschikbaar");

  const dagOmzet = berekenDagOmzet(txs);
  const gemOmzetPerDag =
    dagOmzet.length > 0
      ? Math.round(
          (dagOmzet.reduce((s, d) => s + d.omzet, 0) / dagOmzet.length) * 100
        ) / 100
      : 0;
  const gemTxPerDag =
    dagOmzet.length > 0
      ? Math.round(
          (dagOmzet.reduce((s, d) => s + d.aantalTransacties, 0) /
            dagOmzet.length) *
            10
        ) / 10
      : 0;

  const druksteDag = dagOmzet.length
    ? dagOmzet.reduce((a, b) => (a.omzet > b.omzet ? a : b))
    : null;
  const rustigsteDag = dagOmzet.length
    ? dagOmzet.reduce((a, b) => (a.omzet < b.omzet ? a : b))
    : null;

  const verwachtVandaag = berekenVerwachtVandaag(txs);
  const resterendVandaag =
    Math.round(Math.max(verwachtVandaag - vandaag.omzet, 0) * 100) / 100;

  const laatsteTx =
    txs.length > 0
      ? txs.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
      : null;
  const tijdSindsLaatsteTxMin = laatsteTx
    ? differenceInMinutes(nu, parseISO(laatsteTx.timestamp))
    : null;

  return {
    vandaag,
    gisteren,
    zelfdeDagVorigeWeek,
    dezeWeek,
    vorigeWeek,
    dezeMaand,
    vorigeMaandTotNu,
    ditJaar,
    vorigJaarTotNu,
    totaal,
    gemTxPerDag,
    gemOmzetPerDag,
    druksteDag: druksteDag
      ? { datum: druksteDag.datum, omzet: druksteDag.omzet }
      : null,
    rustigsteDag: rustigsteDag
      ? { datum: rustigsteDag.datum, omzet: rustigsteDag.omzet }
      : null,
    verwachtVandaag,
    resterendVandaag,
    groei: {
      tovGisteren: groei(vandaag.omzet, gisteren.omzet),
      tovZelfdeDagVorigeWeek: groei(vandaag.omzet, zelfdeDagVorigeWeek.omzet),
      tovVorigeWeek: groei(dezeWeek.omzet, vorigeWeek.omzet),
      tovVorigeMaand: groei(dezeMaand.omzet, vorigeMaandTotNu.omzet),
      tovVorigJaar: groei(ditJaar.omzet, vorigJaarTotNu.omzet),
    },
    laatsteTx,
    tijdSindsLaatsteTxMin,
  };
}

export interface Schommeling {
  datum: string;
  omzet: number;
  referentie: number;            // waar we tegen vergeleken
  type: "piek" | "dal";
  afwijking: number;              // % vs referentie
  context: string;                // "vs gem. zaterdagen (laatste 8 weken)" of "vs Koningsdag 2024"
  feestdag?: string | null;
  vakantie?: string | null;
}

export function detecteerSchommelingen(
  dagOmzet: DagOmzet[],
  dagenTerug = 60
): Schommeling[] {
  if (dagOmzet.length < 14) return [];

  const nu = new Date();
  const grens = subDays(nu, dagenTerug);

  // Volledige index voor snel opzoeken per datum
  const index = new Map<string, number>();
  for (const d of dagOmzet) index.set(d.datum, d.omzet);

  // Gemiddelde per weekdag op basis van de laatste 8 weken, excl. feestdagen
  const weekdagOmzetten: number[][] = Array.from({ length: 7 }, () => []);
  const grens8w = subDays(nu, 56);
  for (const d of dagOmzet) {
    const dt = parseISO(d.datum);
    if (dt < grens8w) continue;
    if (feestdagOpDatum(dt)) continue;
    weekdagOmzetten[getDay(dt)].push(d.omzet);
  }
  const weekdagGem = weekdagOmzetten.map((v) =>
    v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0
  );

  const DAGEN_NL = ["zondagen", "maandagen", "dinsdagen", "woensdagen", "donderdagen", "vrijdagen", "zaterdagen"];

  const resultaat: Schommeling[] = [];

  for (const d of dagOmzet) {
    const dt = parseISO(d.datum);
    if (dt < grens) continue;

    const feest = feestdagOpDatum(dt);
    const vak = vakantieOpDatum(dt);

    let referentie = 0;
    let context = "";

    if (feest) {
      // Vergelijk met dezelfde feestdag vorig jaar
      const vorigJaar = new Date(dt.getFullYear() - 1, dt.getMonth(), dt.getDate());
      const vorigKey = format(vorigJaar, "yyyy-MM-dd");
      const vorigOmzet = index.get(vorigKey);
      if (vorigOmzet !== undefined && vorigOmzet > 0) {
        referentie = vorigOmzet;
        context = `vs ${feest.naam} ${vorigJaar.getFullYear()}`;
      } else {
        // Geen historische vergelijking mogelijk
        continue;
      }
    } else {
      // Normale dag: vergelijk tegen gem. zelfde weekdag laatste 8 weken
      const wd = getDay(dt);
      const gem = weekdagGem[wd];
      if (gem === 0) continue;
      referentie = gem;
      context = `vs gem. ${DAGEN_NL[wd]} (laatste 8 weken)`;
    }

    if (referentie === 0) continue;
    const afwPct = ((d.omzet - referentie) / referentie) * 100;

    // Drempel: 25%+ afwijking
    if (Math.abs(afwPct) < 25) continue;

    resultaat.push({
      datum: d.datum,
      omzet: d.omzet,
      referentie: Math.round(referentie * 100) / 100,
      type: afwPct > 0 ? "piek" : "dal",
      afwijking: Math.round(afwPct),
      context,
      feestdag: feest?.naam ?? null,
      vakantie: vak?.naam ?? null,
    });
  }

  // Meest recente eerst; max 12
  return resultaat
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .slice(0, 12);
}

export interface Suggestie {
  titel: string;
  detail: string;
  toon: "positief" | "attentie" | "neutraal" | "waarschuwing";
}

export interface CruiseHint {
  datum: string;
  totaalPassagiers: number;
  aantal: number;
  dagenVanNu: number;
}

export function genereerSuggesties(
  piekuren: UurData[],
  topProducten: ProductData[],
  prognose: Prognose[],
  kerncijfers: KernCijfers,
  schommelingen: Schommeling[] = [],
  cruises: CruiseHint[] = []
): Suggestie[] {
  const s: Suggestie[] = [];
  const k = kerncijfers;

  // Live: hoe gaat het vandaag t.o.v. verwacht
  if (k.verwachtVandaag > 0) {
    const realisatie = (k.vandaag.omzet / k.verwachtVandaag) * 100;
    if (k.vandaag.omzet === 0) {
      s.push({
        titel: "Dag is nog niet gestart",
        detail: `Doel voor vandaag: €${k.verwachtVandaag.toFixed(0)} (gem. van deze weekdag laatste 8 weken).`,
        toon: "neutraal",
      });
    } else if (realisatie >= 100) {
      s.push({
        titel: `Boven target: ${Math.round(realisatie)}%`,
        detail: `Vandaag €${k.vandaag.omzet.toFixed(0)}, doel €${k.verwachtVandaag.toFixed(0)}. ${Math.round(realisatie - 100)}% voor op schema.`,
        toon: "positief",
      });
    } else if (realisatie < 70) {
      s.push({
        titel: `Achter op schema: ${Math.round(realisatie)}%`,
        detail: `Vandaag €${k.vandaag.omzet.toFixed(0)}, doel €${k.verwachtVandaag.toFixed(0)}. Nog €${(k.verwachtVandaag - k.vandaag.omzet).toFixed(0)} te gaan.`,
        toon: "attentie",
      });
    }
  }

  // Week
  if (k.groei.tovVorigeWeek !== 0 && Math.abs(k.groei.tovVorigeWeek) > 5) {
    s.push({
      titel:
        k.groei.tovVorigeWeek > 0
          ? `Deze week +${k.groei.tovVorigeWeek}% vs vorige week`
          : `Deze week ${k.groei.tovVorigeWeek}% vs vorige week`,
      detail: `€${k.dezeWeek.omzet.toFixed(0)} vs €${k.vorigeWeek.omzet.toFixed(0)} in dezelfde periode vorige week.`,
      toon: k.groei.tovVorigeWeek > 0 ? "positief" : "attentie",
    });
  }

  // Jaar-op-jaar
  if (k.vorigJaarTotNu.omzet > 0 && Math.abs(k.groei.tovVorigJaar) >= 5) {
    s.push({
      titel:
        k.groei.tovVorigJaar > 0
          ? `Jaar-op-jaar +${k.groei.tovVorigJaar}%`
          : `Jaar-op-jaar ${k.groei.tovVorigJaar}%`,
      detail: `YTD €${k.ditJaar.omzet.toFixed(0)} vs €${k.vorigJaarTotNu.omzet.toFixed(0)} zelfde periode ${new Date().getFullYear() - 1}.`,
      toon: k.groei.tovVorigJaar >= 0 ? "positief" : "waarschuwing",
    });
  }

  // Piekuur
  const actieveUren = piekuren.filter((u) => u.gemiddeld > 0);
  if (actieveUren.length > 0) {
    const topPiek = actieveUren.reduce((a, b) =>
      a.gemiddeld > b.gemiddeld ? a : b
    );
    s.push({
      titel: `Piekuur is ${topPiek.label}`,
      detail: `Gem. €${topPiek.gemiddeld.toFixed(0)} in dit uur. Zorg dat bezetting rond dit tijdstip op orde is.`,
      toon: "neutraal",
    });
  }

  // Rustig middaggat
  const middag = piekuren.filter(
    (u) => u.uur >= 14 && u.uur <= 16 && u.aantalDagen > 0
  );
  if (
    middag.length >= 2 &&
    middag.every((u) => u.gemiddeld < (actieveUren[0]?.gemiddeld ?? 0) * 0.25)
  ) {
    const gemMiddag = middag.reduce((s, u) => s + u.gemiddeld, 0) / middag.length;
    s.push({
      titel: "Dal 14:00–16:00",
      detail: `Gem. slechts €${gemMiddag.toFixed(0)} per uur in dit tijdslot. Overweeg een deal of contentcampagne.`,
      toon: "attentie",
    });
  }

  // Hardloper
  if (topProducten.length > 0) {
    const top = topProducten[0];
    s.push({
      titel: `Hardloper: ${top.naam}`,
      detail: `€${top.omzet.toFixed(0)} omzet (${top.aandeel.toFixed(1)}% van de productomzet, ${top.aantal.toLocaleString("nl-NL")} verkocht).`,
      toon: "positief",
    });
  }

  // Sterkste stijger
  const stijgers = topProducten
    .filter((p) => p.omzet > 100 && p.trend > 25)
    .slice(0, 1);
  if (stijgers.length > 0) {
    s.push({
      titel: `Stijger: ${stijgers[0].naam}`,
      detail: `+${stijgers[0].trend}% in de laatste 30 dagen (t.o.v. 30 dagen daarvoor). Kandidaat om verder te pushen.`,
      toon: "positief",
    });
  }

  // Sterkste daler
  const dalers = topProducten
    .filter((p) => p.omzet > 100 && p.trend < -25)
    .slice(0, 1);
  if (dalers.length > 0) {
    s.push({
      titel: `Daler: ${dalers[0].naam}`,
      detail: `${dalers[0].trend}% in de laatste 30 dagen. Check aanbod, prijs of zichtbaarheid.`,
      toon: "attentie",
    });
  }

  // Feestdag / vakantie attentie in komende 14 dagen
  const komendeFeestdag = prognose.find((p) => p.feestdag);
  if (komendeFeestdag) {
    const dagNr = parseISO(komendeFeestdag.datum);
    const overDagen = Math.round(
      (dagNr.getTime() - new Date().setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );
    s.push({
      titel: `${komendeFeestdag.feestdag} over ${overDagen} ${overDagen === 1 ? "dag" : "dagen"}`,
      detail:
        komendeFeestdag.verwacht > 0
          ? `Verwacht €${komendeFeestdag.verwacht.toFixed(0)} op basis van vorig jaar. Check roosters en voorraad.`
          : "Geen referentie van vorig jaar. Plan op basis van eigen inschatting.",
      toon: "attentie",
    });
  }
  const komendeVakantie = prognose.find((p) => p.vakantie);
  if (komendeVakantie && !komendeFeestdag) {
    s.push({
      titel: `Vakantie: ${komendeVakantie.vakantie}`,
      detail: `Van invloed op drukte in de komende 14 dagen. Verwachte omzet fluctueert per weekdag.`,
      toon: "neutraal",
    });
  }

  // Drukste dag in prognose
  const druksteDag = prognose
    .filter((p) => !p.feestdag)
    .reduce<Prognose | null>(
      (a, b) => (!a || b.verwacht > a.verwacht ? b : a),
      null
    );
  if (druksteDag && druksteDag.druk === "zeer druk") {
    s.push({
      titel: `Drukste dag: ${druksteDag.dagNaam}`,
      detail: `Verwacht €${druksteDag.verwacht.toFixed(0)}. Prep op tijd.`,
      toon: "neutraal",
    });
  }

  // Grote cruise in komende 7 dagen
  const komendeCruise = cruises
    .filter((c) => c.dagenVanNu >= 0 && c.dagenVanNu <= 7)
    .sort((a, b) => b.totaalPassagiers - a.totaalPassagiers)[0];
  if (komendeCruise && komendeCruise.totaalPassagiers >= 1500) {
    const label =
      komendeCruise.dagenVanNu === 0
        ? "vandaag"
        : komendeCruise.dagenVanNu === 1
        ? "morgen"
        : `over ${komendeCruise.dagenVanNu} dagen`;
    s.push({
      titel: `Cruise ${label}: ${komendeCruise.totaalPassagiers.toLocaleString("nl-NL")} passagiers`,
      detail:
        komendeCruise.aantal > 1
          ? `${komendeCruise.aantal} schepen in Rotterdam. Reken op extra loopverkeer naar de Markthal.`
          : "Groot cruiseschip in Rotterdam. Reken op extra loopverkeer naar de Markthal.",
      toon: "attentie",
    });
  }

  // Opvallende schommeling laatste dagen
  const recenteSchommeling = schommelingen[0];
  if (recenteSchommeling) {
    s.push({
      titel:
        recenteSchommeling.type === "piek"
          ? `Uitschieter: +${recenteSchommeling.afwijking}% op ${format(parseISO(recenteSchommeling.datum), "dd-MM-yyyy")}`
          : `Dip: ${recenteSchommeling.afwijking}% op ${format(parseISO(recenteSchommeling.datum), "dd-MM-yyyy")}`,
      detail: `€${recenteSchommeling.omzet.toFixed(0)} ${recenteSchommeling.context}. ${recenteSchommeling.feestdag ?? recenteSchommeling.vakantie ?? ""}`.trim(),
      toon: recenteSchommeling.type === "piek" ? "positief" : "attentie",
    });
  }

  return s;
}
