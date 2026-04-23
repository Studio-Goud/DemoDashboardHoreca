import type { IngTransactie } from "./ing";
import type { Factuur } from "./factuur-ai";

export interface ContantRegel {
  id: string;
  datum: string;        // YYYY-MM-DD
  omschrijving: string;
  bedrag: number;       // positief
  btw21: number;
  btw9: number;
  type: "inkomst" | "uitgave";
}

export interface MaandSamenvatting {
  jaar: number;
  maand: number;
  // Omzet (via SumUp/Zettle, aparte bron)
  omzetBruto: number;
  omzetBtwBetaald: number;    // BTW die klanten betalen (9% horeca)
  // Kosten (ING + facturen + contant)
  kostenTotaal: number;
  voorbelasting21: number;    // BTW op kosten 21% (terug te vragen)
  voorbelasting9: number;     // BTW op kosten 9% (terug te vragen)
  voorbelastingTotaal: number;
  // Contant
  contantInkomsten: number;
  contantUitgaven: number;
  contantBtw21: number;
  contantBtw9: number;
  // Salarissen (geen BTW)
  salarissen: number;
  // Netto resultaat
  brutoResultaat: number;     // omzetBruto - kostenTotaal
  nettoResultaat: number;     // na BTW verrekening
  status: "winst" | "quitte" | "verlies";
  // BTW aangifte
  btwTeVoldoen: number;       // omzetBtw - voorbelasting (positief = betalen, negatief = ontvangen)
  // Kostenbreakdown per categorie (excl. salarissen)
  categorieBreakdown: Record<string, number>;
  // Opsplitsing kostenbronnen
  kostenIng: number;
  kostenFacturen: number;
  kostenContant: number;
  // DGA salaris
  dgaEchtRotterdams: number;
  dgaMp5: number;
  dgaMp5Genormaliseerd: number; // kwartaalbetaling gespreid over 3 maanden
}

export interface KwartaalRapport {
  jaar: number;
  kwartaal: 1 | 2 | 3 | 4;
  bedrijf: string;
  maanden: MaandSamenvatting[];
  totaal: {
    omzetBruto: number;
    kostenTotaal: number;
    salarissen: number;
    voorbelastingTotaal: number;
    omzetBtwTotaal: number;
    btwTeVoldoen: number;
    nettoResultaat: number;
  };
  ingTransacties: IngTransactie[];
  facturen: Factuur[];
  contant: ContantRegel[];
  reviewItems: number;        // aantal transacties die handmatige check nodig hebben
}

function rnd(n: number): number {
  return Math.round(n * 100) / 100;
}

const SALARIS_CATEGORIEEN = new Set(["salaris", "loon", "loonkosten", "dga-er", "dga-mp5"]);

function isSalaris(tx: IngTransactie): boolean {
  // Online Banking transfers naar personen (naam zonder bedrijfsaanduiding) zonder BTW
  if (tx.mutatiesoort !== "Online Banking" && !tx.mutatiesoort.includes("Transfer")) return false;
  if (tx.btw21 > 0 || tx.btw9 > 0) return false;
  if (tx.richting !== "debit") return false;
  if (SALARIS_CATEGORIEEN.has(tx.categorie)) return true;
  // Heuristiek: persoonsnaam (enkel woord hoofdletter + achternaam, geen "B.V." of "Ltd")
  return /^[A-Z]{1,3}\s+[A-Z][A-Z]+$/.test(tx.omschrijving.trim()) ||
    /^[A-Z]{1,2}\s+[A-Z]+\s+[A-Z]/.test(tx.omschrijving.trim());
}

export function berekenMaand(
  jaar: number,
  maand: number,
  ingTxs: IngTransactie[],
  facturen: Factuur[],
  contant: ContantRegel[],
  omzetBruto = 0,
  omzetBtwBetaald = 0,
): MaandSamenvatting {
  const prefix = `${jaar}-${String(maand).padStart(2, "0")}`;

  // Volgende maand voor salarisoverheveling
  const vMaand = maand === 12 ? 1 : maand + 1;
  const vJaar  = maand === 12 ? jaar + 1 : jaar;
  const vPrefix = `${vJaar}-${String(vMaand).padStart(2, "0")}`;

  const maandDebits = ingTxs.filter((t) => t.datum.startsWith(prefix) && t.richting === "debit");

  // Salarissen op dag 1-3 van DEZE maand horen bij vorige maand → uitsluiten
  const vroegeSalarisIds = new Set(
    maandDebits
      .filter((t) => isSalaris(t) && parseInt(t.datum.slice(8, 10)) <= 6)
      .map((t) => t.id)
  );

  // Salarissen op dag 1-3 van VOLGENDE maand horen bij DEZE maand → toevoegen
  const salarisOverloop = ingTxs.filter(
    (t) => t.datum.startsWith(vPrefix) && t.richting === "debit" &&
            isSalaris(t) && parseInt(t.datum.slice(8, 10)) <= 6
  );

  const maandTxs = [
    ...maandDebits.filter((t) => !vroegeSalarisIds.has(t.id)),
    ...salarisOverloop,
  ];

  const maandFacturen = facturen.filter((f) => f.datum.startsWith(prefix));
  const maandContant = contant.filter((c) => c.datum.startsWith(prefix));

  // ING kosten
  let kostenIng = 0;
  let voorb21Ing = 0;
  let voorb9Ing = 0;
  let salarissen = 0;
  let dgaEchtRotterdams = 0;
  let dgaMp5 = 0;
  const catMap: Record<string, number> = {};

  for (const tx of maandTxs) {
    if (isSalaris(tx)) {
      salarissen += tx.bedrag;
      catMap["salaris"] = (catMap["salaris"] ?? 0) + tx.bedrag;
      if (tx.categorie === "dga-er") dgaEchtRotterdams += tx.bedrag;
      if (tx.categorie === "dga-mp5") dgaMp5 += tx.bedrag;
    } else if (tx.categorie !== "omzet" && tx.categorie !== "contant") {
      kostenIng += tx.bedrag;
      voorb21Ing += tx.btw21;
      voorb9Ing += tx.btw9;
      catMap[tx.categorie] = (catMap[tx.categorie] ?? 0) + tx.bedrag;
    }
  }

  // Factuur kosten
  let kostenFacturen = 0;
  let voorb21Facturen = 0;
  let voorb9Facturen = 0;

  for (const f of maandFacturen) {
    if (f.status === "review") continue; // niet meetellen tot handmatig goedgekeurd
    kostenFacturen += f.bedragInclBtw;
    voorb21Facturen += f.btw21;
    voorb9Facturen += f.btw9;
  }

  // Contant
  const contantInkomsten = maandContant.filter((c) => c.type === "inkomst").reduce((s, c) => s + c.bedrag, 0);
  const contantUitgaven  = maandContant.filter((c) => c.type === "uitgave").reduce((s, c) => s + c.bedrag, 0);
  const contantBtw21 = maandContant.reduce((s, c) => s + c.btw21, 0);
  const contantBtw9  = maandContant.reduce((s, c) => s + c.btw9, 0);

  // MP5 kwartaaltotaal: alle dga-mp5 betalingen in hetzelfde kwartaal als deze maand
  const qStart = Math.ceil(maand / 3) * 3 - 2;
  const qPrefixes = [qStart, qStart + 1, qStart + 2].map(
    (m) => `${jaar}-${String(m).padStart(2, "0")}`
  );
  const mp5KwartaalTotaal = ingTxs
    .filter((t) => qPrefixes.some((p) => t.datum.startsWith(p)) && t.categorie === "dga-mp5")
    .reduce((s, t) => s + t.bedrag, 0);

  const kostenTotaal = rnd(kostenIng + kostenFacturen + contantUitgaven);
  const voorbelasting21 = rnd(voorb21Ing + voorb21Facturen + contantBtw21);
  const voorbelasting9  = rnd(voorb9Ing  + voorb9Facturen  + contantBtw9);
  const voorbelastingTotaal = rnd(voorbelasting21 + voorbelasting9);

  const brutoResultaat = rnd(omzetBruto + contantInkomsten - kostenTotaal - salarissen);
  const btwTeVoldoen   = rnd(omzetBtwBetaald - voorbelastingTotaal);
  const nettoResultaat = rnd(brutoResultaat - Math.max(0, btwTeVoldoen));

  const status: MaandSamenvatting["status"] =
    nettoResultaat > 100 ? "winst" : nettoResultaat < -100 ? "verlies" : "quitte";

  const categorieBreakdown: Record<string, number> = {};
  for (const [cat, bedrag] of Object.entries(catMap)) {
    categorieBreakdown[cat] = rnd(bedrag);
  }

  return {
    jaar, maand,
    omzetBruto: rnd(omzetBruto),
    omzetBtwBetaald: rnd(omzetBtwBetaald),
    kostenTotaal,
    kostenIng: rnd(kostenIng),
    kostenFacturen: rnd(kostenFacturen),
    kostenContant: rnd(contantUitgaven),
    dgaEchtRotterdams: rnd(dgaEchtRotterdams),
    dgaMp5: rnd(dgaMp5),
    dgaMp5Genormaliseerd: rnd(mp5KwartaalTotaal / 3),
    voorbelasting21,
    voorbelasting9,
    voorbelastingTotaal,
    contantInkomsten: rnd(contantInkomsten),
    contantUitgaven: rnd(contantUitgaven),
    contantBtw21: rnd(contantBtw21),
    contantBtw9: rnd(contantBtw9),
    salarissen: rnd(salarissen),
    brutoResultaat,
    nettoResultaat,
    status,
    btwTeVoldoen,
    categorieBreakdown,
  };
}

export function berekenKwartaal(
  jaar: number,
  kwartaal: 1 | 2 | 3 | 4,
  bedrijf: string,
  ingTxs: IngTransactie[],
  facturen: Factuur[],
  contant: ContantRegel[],
  maandOmzet: Record<number, { bruto: number; btw: number }> = {},
): KwartaalRapport {
  const startMaand = (kwartaal - 1) * 3 + 1;
  const maanden: MaandSamenvatting[] = [];

  for (let m = startMaand; m < startMaand + 3; m++) {
    const omzet = maandOmzet[m] ?? { bruto: 0, btw: 0 };
    maanden.push(berekenMaand(jaar, m, ingTxs, facturen, contant, omzet.bruto, omzet.btw));
  }

  const reviewItems = ingTxs.filter(
    (t) => t.btwStatus === "review" && t.datum.startsWith(String(jaar))
  ).length;

  const totaal = {
    omzetBruto:          rnd(maanden.reduce((s, m) => s + m.omzetBruto, 0)),
    kostenTotaal:        rnd(maanden.reduce((s, m) => s + m.kostenTotaal, 0)),
    salarissen:          rnd(maanden.reduce((s, m) => s + m.salarissen, 0)),
    voorbelastingTotaal: rnd(maanden.reduce((s, m) => s + m.voorbelastingTotaal, 0)),
    omzetBtwTotaal:      rnd(maanden.reduce((s, m) => s + m.omzetBtwBetaald, 0)),
    btwTeVoldoen:        rnd(maanden.reduce((s, m) => s + m.btwTeVoldoen, 0)),
    nettoResultaat:      rnd(maanden.reduce((s, m) => s + m.nettoResultaat, 0)),
  };

  // Filter ING transacties voor dit kwartaal
  const kwartaalTxs = ingTxs.filter((t) => {
    const [y, mo] = t.datum.split("-").map(Number);
    return y === jaar && mo >= startMaand && mo < startMaand + 3;
  });

  const kwartaalFacturen = facturen.filter((f) => {
    const [y, mo] = f.datum.split("-").map(Number);
    return y === jaar && mo >= startMaand && mo < startMaand + 3;
  });

  const kwartaalContant = contant.filter((c) => {
    const [y, mo] = c.datum.split("-").map(Number);
    return y === jaar && mo >= startMaand && mo < startMaand + 3;
  });

  return {
    jaar, kwartaal, bedrijf, maanden, totaal,
    ingTransacties: kwartaalTxs,
    facturen: kwartaalFacturen,
    contant: kwartaalContant,
    reviewItems,
  };
}

export function euro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n);
}
