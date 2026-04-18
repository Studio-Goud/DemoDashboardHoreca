import { SumUpTransaction } from "./sumup";
import {
  format,
  startOfDay,
  endOfDay,
  getHours,
  getDay,
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
} from "date-fns";
import { nl } from "date-fns/locale";

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
  druk: "laag" | "normaal" | "druk" | "zeer druk";
  weekdag: number;
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
    const dag = format(parseISO(tx.timestamp), "yyyy-MM-dd");
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
    const dag = format(dt, "yyyy-MM-dd");
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
    const dag = format(dt, "yyyy-MM-dd");
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
    const dt = parseISO(tx.timestamp);
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

export function berekenPrognose(txs: SumUpTransaction[]): Prognose[] {
  // Baseer prognose op gem. per weekdag van de laatste 8 weken
  const nu = new Date();
  const grens = subDays(nu, 56);
  const recent = txs.filter((t) => parseISO(t.timestamp) >= grens);

  const dagOmzetMap = new Map<string, number>();
  for (const tx of recent) {
    const dag = format(parseISO(tx.timestamp), "yyyy-MM-dd");
    dagOmzetMap.set(dag, (dagOmzetMap.get(dag) ?? 0) + tx.amount);
  }

  const weekdagOmzetten: number[][] = Array.from({ length: 7 }, () => []);
  for (const [dag, omzet] of Array.from(dagOmzetMap.entries())) {
    const wd = getDay(parseISO(dag));
    weekdagOmzetten[wd].push(omzet);
  }

  const weekdagGem = weekdagOmzetten.map((v) =>
    v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0
  );
  const maxGem = Math.max(...weekdagGem, 1);

  const prognoses: Prognose[] = [];
  for (let i = 0; i <= 13; i++) {
    const datum = addDays(startOfDay(nu), i);
    const wd = getDay(datum);
    const verwacht = weekdagGem[wd];
    const ratio = verwacht / maxGem;
    prognoses.push({
      datum: format(datum, "yyyy-MM-dd"),
      dagNaam: format(datum, "EEEE d MMM", { locale: nl }),
      verwacht: Math.round(verwacht * 100) / 100,
      weekdag: wd,
      druk:
        ratio > 0.85
          ? "zeer druk"
          : ratio > 0.6
          ? "druk"
          : ratio > 0.3
          ? "normaal"
          : "laag",
    });
  }

  return prognoses;
}

export function berekenWeekdagCurve(
  txs: SumUpTransaction[],
  weekdag: number
): number[] {
  // 24-entry array met gem. omzet per uur voor deze weekdag (laatste 8 weken)
  const nu = new Date();
  const grens = subDays(nu, 56);
  const uurTotaal = new Array(24).fill(0);
  const dagenSet: Set<string>[] = Array.from({ length: 24 }, () => new Set());

  for (const tx of txs) {
    const dt = parseISO(tx.timestamp);
    if (dt < grens) continue;
    if (getDay(dt) !== weekdag) continue;
    const uur = getHours(dt);
    uurTotaal[uur] += tx.amount;
    dagenSet[uur].add(format(dt, "yyyy-MM-dd"));
  }

  // Deel elke uurtotaal door het aantal unieke gemeten dagen voor die weekdag
  const unieke = new Set<string>();
  for (const tx of txs) {
    const dt = parseISO(tx.timestamp);
    if (dt < grens) continue;
    if (getDay(dt) !== weekdag) continue;
    unieke.add(format(dt, "yyyy-MM-dd"));
  }
  const dagen = Math.max(unieke.size, 1);

  return uurTotaal.map((t) => Math.round((t / dagen) * 100) / 100);
}

export function berekenVerwachtVandaag(txs: SumUpTransaction[]): number {
  const nu = new Date();
  const wdVandaag = getDay(nu);
  const grens = subDays(nu, 56);
  const recent = txs.filter((t) => parseISO(t.timestamp) >= grens);

  const perDag = new Map<string, number>();
  for (const tx of recent) {
    const dag = format(parseISO(tx.timestamp), "yyyy-MM-dd");
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

export function detecteerSchommelingen(dagOmzet: DagOmzet[]): Array<{
  datum: string;
  omzet: number;
  type: "piek" | "dal";
  afwijking: number;
}> {
  if (dagOmzet.length < 7) return [];

  const omzetten = dagOmzet.map((d) => d.omzet);
  const gemiddeld = omzetten.reduce((a, b) => a + b, 0) / omzetten.length;
  const variance =
    omzetten.reduce((sum, v) => sum + Math.pow(v - gemiddeld, 2), 0) /
    omzetten.length;
  const stdDev = Math.sqrt(variance);

  return dagOmzet
    .filter((d) => Math.abs(d.omzet - gemiddeld) > 1.8 * stdDev)
    .map((d) => ({
      datum: d.datum,
      omzet: d.omzet,
      type: (d.omzet > gemiddeld ? "piek" : "dal") as "piek" | "dal",
      afwijking: Math.round(((d.omzet - gemiddeld) / gemiddeld) * 100),
    }))
    .slice(-10);
}

export function genereerSuggesties(
  piekuren: UurData[],
  topProducten: ProductData[],
  prognose: Prognose[],
  kerncijfers: KernCijfers
): string[] {
  const suggesties: string[] = [];

  const stiltePeriode = piekuren.filter(
    (u) => u.uur >= 14 && u.uur <= 16 && u.gemiddeld < 10
  );
  if (stiltePeriode.length >= 2) {
    suggesties.push(
      "Tussen 14:00–16:00 is het structureel rustig. Overweeg een happy hour of lunch-deal in dit tijdslot."
    );
  }

  const actieveUren = piekuren.filter((u) => u.gemiddeld > 0);
  if (actieveUren.length > 0) {
    const topPiek = actieveUren.reduce((a, b) =>
      a.gemiddeld > b.gemiddeld ? a : b
    );
    suggesties.push(
      `Piekmoment is consistent rond ${topPiek.label} (gem. €${topPiek.gemiddeld.toFixed(0)} per uur). Zorg voor voldoende bezetting.`
    );
  }

  if (topProducten.length > 0) {
    const top = topProducten[0];
    suggesties.push(
      `"${top.naam}" is je absolute hardloper: €${top.omzet.toFixed(0)} (${top.aandeel.toFixed(1)}% van de productomzet). Altijd voldoende voorraad aanhouden.`
    );
  }

  const stijgers = topProducten.filter((p) => p.trend > 30).slice(0, 2);
  if (stijgers.length > 0) {
    suggesties.push(
      `Sterke stijgers laatste 30 dagen: ${stijgers
        .map((s) => `"${s.naam}" (+${s.trend}%)`)
        .join(", ")}. Mogelijk verder promoten.`
    );
  }

  const dalers = topProducten
    .filter((p) => p.omzet > 50 && p.trend < -30)
    .slice(0, 2);
  if (dalers.length > 0) {
    suggesties.push(
      `Dalers: ${dalers
        .map((s) => `"${s.naam}" (${s.trend}%)`)
        .join(", ")}. Herzien of promotie overwegen.`
    );
  }

  if (topProducten.length >= 5) {
    const doodloper = topProducten[topProducten.length - 1];
    suggesties.push(
      `"${doodloper.naam}" verkoopt nauwelijks (€${doodloper.omzet.toFixed(0)}). Overweeg van de kaart te halen.`
    );
  }

  const druksteDag = prognose.find((p) => p.druk === "zeer druk");
  if (druksteDag) {
    suggesties.push(
      `${druksteDag.dagNaam} wordt naar verwachting zeer druk (€${druksteDag.verwacht.toFixed(0)}). Prep alvast extra.`
    );
  }

  if (kerncijfers.groei.tovVorigJaar < -10) {
    suggesties.push(
      `Jaar-op-jaar ligt de omzet ${kerncijfers.groei.tovVorigJaar}% onder vorig jaar. Check campagnes of prijsbeleid.`
    );
  } else if (kerncijfers.groei.tovVorigJaar > 15) {
    suggesties.push(
      `Sterk jaar-op-jaar: +${kerncijfers.groei.tovVorigJaar}% vs vorig jaar. Houd dit momentum vast.`
    );
  }

  return suggesties;
}
