import { SumUpTransaction } from "./sumup";
import { format, startOfDay, getHours, getDay, parseISO, subDays } from "date-fns";
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
}

export interface ProductData {
  naam: string;
  omzet: number;
  aantal: number;
}

export interface Prognose {
  datum: string;
  dagNaam: string;
  verwacht: number;
  druk: "laag" | "normaal" | "druk" | "zeer druk";
}

const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const UREN_LABELS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);

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
    .map(([datum, data]) => ({ datum, ...data, aantalTransacties: data.aantal }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export function berekenPiekuren(txs: SumUpTransaction[]): UurData[] {
  const uurTotaal = new Array(24).fill(0);
  const uurDagen = new Array(24).fill(0);
  const dagenSet = new Set<string>();

  for (const tx of txs) {
    const uur = getHours(parseISO(tx.timestamp));
    const dag = format(parseISO(tx.timestamp), "yyyy-MM-dd");
    uurTotaal[uur] += tx.amount;
    dagenSet.add(dag);
    uurDagen[uur]++;
  }

  const aantalDagen = Math.max(dagenSet.size, 1);

  return Array.from({ length: 24 }, (_, i) => ({
    uur: i,
    label: UREN_LABELS[i],
    totaal: uurTotaal[i],
    gemiddeld: uurTotaal[i] / aantalDagen,
  }));
}

export function berekenTopProducten(txs: SumUpTransaction[]): ProductData[] {
  const map = new Map<string, { omzet: number; aantal: number }>();

  for (const tx of txs) {
    if (!tx.products) continue;
    for (const p of tx.products) {
      const bestaand = map.get(p.name) ?? { omzet: 0, aantal: 0 };
      map.set(p.name, {
        omzet: bestaand.omzet + p.price * p.quantity,
        aantal: bestaand.aantal + p.quantity,
      });
    }
  }

  return Array.from(map.entries())
    .map(([naam, data]) => ({ naam, ...data }))
    .sort((a, b) => b.omzet - a.omzet);
}

export function berekenPrognose(txs: SumUpTransaction[]): Prognose[] {
  const dagGemiddelden = new Array(7).fill(0);
  const dagTellingen = new Array(7).fill(0);

  for (const tx of txs) {
    const dag = getDay(parseISO(tx.timestamp));
    dagGemiddelden[dag] += tx.amount;
    dagTellingen[dag]++;
  }

  // Groepeer per dag en bereken gemiddelde omzet
  const dagOmzetMap = new Map<string, number[]>();
  for (const tx of txs) {
    const dagKey = format(parseISO(tx.timestamp), "yyyy-MM-dd");
    const bestaand = dagOmzetMap.get(dagKey) ?? [];
    bestaand.push(tx.amount);
    dagOmzetMap.set(dagKey, bestaand);
  }

  const weekdagOmzetten: number[][] = Array.from({ length: 7 }, () => []);
  for (const [dag, bedragen] of Array.from(dagOmzetMap.entries())) {
    const weekdag = getDay(parseISO(dag));
    weekdagOmzetten[weekdag].push(bedragen.reduce((a, b) => a + b, 0));
  }

  const weekdagGemiddeld = weekdagOmzetten.map((omzetten) =>
    omzetten.length > 0
      ? omzetten.reduce((a, b) => a + b, 0) / omzetten.length
      : 0
  );

  const maxGemiddeld = Math.max(...weekdagGemiddeld);

  const prognoses: Prognose[] = [];
  for (let i = 1; i <= 14; i++) {
    const datum = subDays(new Date(), -i);
    const weekdag = getDay(datum);
    const verwacht = weekdagGemiddeld[weekdag];
    const ratio = maxGemiddeld > 0 ? verwacht / maxGemiddeld : 0;

    prognoses.push({
      datum: format(datum, "yyyy-MM-dd"),
      dagNaam: format(datum, "EEEE d MMM", { locale: nl }),
      verwacht: Math.round(verwacht * 100) / 100,
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
  prognose: Prognose[]
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

  const topPiek = piekuren.reduce((a, b) => (a.gemiddeld > b.gemiddeld ? a : b));
  suggesties.push(
    `Piekmoment is consistent rond ${topPiek.label}. Zorg voor voldoende bezetting op dit tijdstip.`
  );

  if (topProducten.length > 0) {
    suggesties.push(
      `"${topProducten[0].naam}" is je absolute hardloper. Altijd voldoende voorraad aanhouden.`
    );
  }

  if (topProducten.length >= 5) {
    const doodloper = topProducten[topProducten.length - 1];
    suggesties.push(
      `"${doodloper.naam}" verkoopt nauwelijks. Overweeg dit van de kaart te halen of te promoten.`
    );
  }

  const druksteDag = prognose.find((p) => p.druk === "zeer druk");
  if (druksteDag) {
    suggesties.push(
      `${druksteDag.dagNaam} wordt een drukke dag. Prep alvast extra voor dan.`
    );
  }

  return suggesties;
}
