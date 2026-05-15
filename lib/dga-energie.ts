/**
 * DGA-onttrekkingen + energie-kosten YTD per bedrijf.
 *
 * - DGA: Echt Rotterdams BV (Ricardo) + MP5 (Matthieu). Patronen herkennen
 *   die transacties al automatisch (categorie "dga-er" / "dga-mp5").
 *   Belangrijk voor jaaraangifte: hoeveel hebben we al opgenomen?
 * - Energie: gas/elektra/water leveranciers (Eneco, Vattenfall, Evides,
 *   netbeheer Enexis/Stedin/Liander). Aparte tracker want energie is een
 *   serieus % van de kostenstructuur.
 */
import { haalIngOp, haalContantOp } from "./boekhouding-kv";

export type BedrijfSlug = "bb" | "sl" | "kl";

export interface DgaUittreksel {
  bedrijf: BedrijfSlug;
  jaar: number;
  /** Per DGA-categorie: cumulatief bedrag + aantal transacties. */
  perDga: Array<{
    categorie: "dga-er" | "dga-mp5";
    label: string;
    totaal: number;
    aantal: number;
    laatste: { datum: string; bedrag: number; omschrijving: string } | null;
  }>;
  /** Per maand de som over alle DGA's — voor grafiek. */
  perMaand: Array<{ maand: number; totaal: number }>;
  totaal: number;
}

export interface EnergieUittreksel {
  bedrijf: BedrijfSlug;
  jaar: number;
  /** Per maand bedrag + transactie-aantal. */
  perMaand: Array<{ maand: number; bedrag: number; aantal: number }>;
  /** Per leverancier: aggregatie. */
  perLeverancier: Array<{
    leverancier: string;
    totaal: number;
    aantal: number;
  }>;
  totaal: number;
  aantal: number;
  gemPerMaand: number;
}

const DGA_LABELS: Record<"dga-er" | "dga-mp5", string> = {
  "dga-er": "Echt Rotterdams BV (Ricardo)",
  "dga-mp5": "MP5 (Matthieu)",
};

export async function dgaUittreksel(bedrijf: BedrijfSlug, jaar: number): Promise<DgaUittreksel> {
  const [txs, contantRegels] = await Promise.all([
    haalIngOp(bedrijf, jaar),
    haalContantOp(bedrijf, jaar),
  ]);
  // Normaliseer contant DGA-uitbetalingen naar hetzelfde shape als ING-txs zodat
  // de rest van de aggregatie ongewijzigd blijft. Alleen velden die we hier
  // gebruiken (datum, bedrag, categorie, omschrijving) worden gevuld.
  const contantAlsTx = contantRegels
    .filter((c) => c.type === "uitgave" && (c.categorie === "dga-er" || c.categorie === "dga-mp5"))
    .map((c) => ({
      datum: c.datum,
      bedrag: c.bedrag,
      categorie: c.categorie as "dga-er" | "dga-mp5",
      omschrijving: `${c.omschrijving} (cash)`,
    }));
  const ingDgaTxs = txs
    .filter((t) => t.categorie === "dga-er" || t.categorie === "dga-mp5")
    .map((t) => ({
      datum: t.datum,
      bedrag: t.bedrag,
      categorie: t.categorie as "dga-er" | "dga-mp5",
      omschrijving: t.omschrijving,
    }));
  const dgaTxs = [...ingDgaTxs, ...contantAlsTx].sort((a, b) => a.datum.localeCompare(b.datum));

  const perDgaMap = new Map<string, { totaal: number; aantal: number; laatsteIdx: number }>();
  const perMaandMap = new Map<number, number>();

  dgaTxs.forEach((t, idx) => {
    const huidig = perDgaMap.get(t.categorie) ?? { totaal: 0, aantal: 0, laatsteIdx: -1 };
    huidig.totaal += t.bedrag;
    huidig.aantal += 1;
    huidig.laatsteIdx = idx; // index in dgaTxs van laatste-gevonden (na sortering)
    perDgaMap.set(t.categorie, huidig);

    const maand = Number(t.datum.slice(5, 7));
    perMaandMap.set(maand, (perMaandMap.get(maand) ?? 0) + t.bedrag);
  });

  // dgaTxs is gesorteerd op datum (zie haalIngOp). Laatste in array = nieuwste.
  // We pakken voor "laatste" daadwerkelijk de meest-recente datum.
  const perDga = (["dga-er", "dga-mp5"] as const).map((cat) => {
    const stats = perDgaMap.get(cat);
    if (!stats) {
      return { categorie: cat, label: DGA_LABELS[cat], totaal: 0, aantal: 0, laatste: null };
    }
    const transactiesVoorDeze = dgaTxs.filter((t) => t.categorie === cat);
    const laatste = transactiesVoorDeze[transactiesVoorDeze.length - 1];
    return {
      categorie: cat,
      label: DGA_LABELS[cat],
      totaal: Math.round(stats.totaal * 100) / 100,
      aantal: stats.aantal,
      laatste: laatste ? {
        datum: laatste.datum,
        bedrag: laatste.bedrag,
        omschrijving: laatste.omschrijving,
      } : null,
    };
  });

  const perMaand = Array.from({ length: 12 }, (_, i) => ({
    maand: i + 1,
    totaal: Math.round((perMaandMap.get(i + 1) ?? 0) * 100) / 100,
  }));

  const totaal = perDga.reduce((s, d) => s + d.totaal, 0);

  return { bedrijf, jaar, perDga, perMaand, totaal: Math.round(totaal * 100) / 100 };
}

/**
 * Pak de eerste 2-3 woorden van een omschrijving om "leverancier" af te leiden
 * (Eneco/Vattenfall/Evides etc.). Genormaliseerd naar lowercase + getrimd.
 */
function leverancierUitOmschrijving(omschrijving: string): string {
  return omschrijving
    .toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|nederland|holding)\b/g, "")
    .replace(/[^a-zà-ž\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export async function energieUittreksel(bedrijf: BedrijfSlug, jaar: number): Promise<EnergieUittreksel> {
  const txs = await haalIngOp(bedrijf, jaar);
  const energieTxs = txs.filter((t) => t.categorie === "energie" && t.richting === "debit");

  const perMaandMap = new Map<number, { bedrag: number; aantal: number }>();
  const perLeverancierMap = new Map<string, { totaal: number; aantal: number }>();

  for (const t of energieTxs) {
    const maand = Number(t.datum.slice(5, 7));
    const huidig = perMaandMap.get(maand) ?? { bedrag: 0, aantal: 0 };
    huidig.bedrag += t.bedrag;
    huidig.aantal += 1;
    perMaandMap.set(maand, huidig);

    const leverancier = leverancierUitOmschrijving(t.omschrijving);
    const lev = perLeverancierMap.get(leverancier) ?? { totaal: 0, aantal: 0 };
    lev.totaal += t.bedrag;
    lev.aantal += 1;
    perLeverancierMap.set(leverancier, lev);
  }

  const perMaand = Array.from({ length: 12 }, (_, i) => {
    const stats = perMaandMap.get(i + 1) ?? { bedrag: 0, aantal: 0 };
    return {
      maand: i + 1,
      bedrag: Math.round(stats.bedrag * 100) / 100,
      aantal: stats.aantal,
    };
  });

  const perLeverancier = Array.from(perLeverancierMap.entries())
    .map(([leverancier, stats]) => ({
      leverancier,
      totaal: Math.round(stats.totaal * 100) / 100,
      aantal: stats.aantal,
    }))
    .sort((a, b) => b.totaal - a.totaal);

  const totaal = energieTxs.reduce((s, t) => s + t.bedrag, 0);
  const maandenMetData = perMaand.filter((m) => m.bedrag > 0).length;
  const gemPerMaand = maandenMetData > 0 ? totaal / maandenMetData : 0;

  return {
    bedrijf, jaar,
    perMaand,
    perLeverancier,
    totaal: Math.round(totaal * 100) / 100,
    aantal: energieTxs.length,
    gemPerMaand: Math.round(gemPerMaand * 100) / 100,
  };
}
