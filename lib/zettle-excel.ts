import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import type { Bedrijf } from "./sumup";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface JaarOmzet {
  jaar: number;
  omzetInclBtw: number;
  omzetExclBtw: number;
  btw: number;
  aantalTransacties: number;
  gemiddeldeBon: number;
  itemsPerBon: number;
  omzetPos: number;          // kaart/reader
  omzetContant: number;
  kortingen: number;
  bron: "zettle";
}

export interface ProductLevens {
  naam: string;
  variant: string;
  categorie: string;
  aantalVerkocht: number;
  kortingen: number;
  omzetInclBtw: number;
  omzetExclBtw: number;
  btw: number;
  winst: number | null;
  winstmarge: number | null;
}

const IZETTLE_BESTANDEN: Record<Bedrijf, Array<{ bestand: string; jaar: number }>> = {
  bb: [
    { bestand: "Izettle Brunch & Brew-20230101-20231231.xlsx", jaar: 2023 },
    { bestand: "Izettle Brunch & Brew-20240101-20241231.xlsx", jaar: 2024 },
    { bestand: "Izettle Brunch & Brew-20250101-20251231.xlsx", jaar: 2025 },
  ],
  sl: [
    { bestand: "Izettle Sate Lounge - 20240101-20241231 (1).xlsx", jaar: 2024 },
    { bestand: "Izettle Sate Lounge 20250101-20251231 (1).xlsx", jaar: 2025 },
  ],
  // KL heeft (nog) geen historische Izettle jaarrapporten — snapshot via
  // de API dekt alles wat er is.
  kl: [],
};

const PAYPAL_BESTANDEN: Record<Bedrijf, string> = {
  bb: "PayPal-POS-Sales-By-Product-Report-20220401-20260418.xlsx",
  sl: "PayPal-POS-Sales-By-Product-Report-20230401-20260418.xlsx",
  // KL heeft (nog) geen PayPal-POS rapport
  kl: "",
};

function leesCellen(pad: string): unknown[][] | null {
  if (!fs.existsSync(pad)) return null;
  try {
    const wb = XLSX.readFile(pad);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
    }) as unknown[][];
  } catch {
    return null;
  }
}

function getNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function leesJaaroverzicht(pad: string, jaar: number): JaarOmzet | null {
  const rows = leesCellen(pad);
  if (!rows) return null;

  // "Totale verkoopoverzicht" — rij "Totaal" met excl/btw/incl
  const totaalRij = rows.find(
    (r) =>
      r[0] === "Totaal" &&
      typeof r[1] === "number" &&
      typeof r[2] === "number" &&
      typeof r[3] === "number"
  );
  const kassaRij = rows.find(
    (r) => r[0] === "Kassasysteem" && typeof r[1] === "number"
  );
  const kortingRij = rows.find(
    (r) => r[0] === "Kortingen" && typeof r[3] === "number"
  );
  const kaartRij = rows.find(
    (r) => typeof r[0] === "string" && (r[0] as string).startsWith("Kaart") && typeof r[2] === "number"
  );
  const contantRij = rows.find(
    (r) => r[0] === "Contant" && typeof r[2] === "number"
  );

  // Personeelslid rijen: kolom 3 = gem. bon, kolom 4 = items/bon
  const personeelsRijen = rows.filter(
    (r) =>
      r[1] != null &&
      typeof r[1] === "number" &&
      typeof r[2] === "number" &&
      typeof r[3] === "number" &&
      typeof r[4] === "number" &&
      typeof r[0] === "string" &&
      !["Totaal", "Kassasysteem"].includes(r[0] as string)
  );
  const gemBonGewogen =
    personeelsRijen.length > 0
      ? personeelsRijen.reduce(
          (s, r) => s + (r[1] as number) * (r[3] as number),
          0
        ) /
        Math.max(
          personeelsRijen.reduce((s, r) => s + (r[1] as number), 0),
          1
        )
      : 0;
  const itemsPerBon =
    personeelsRijen.length > 0
      ? personeelsRijen.reduce(
          (s, r) => s + (r[4] as number) * (r[2] as number),
          0
        ) /
        Math.max(
          personeelsRijen.reduce((s, r) => s + (r[2] as number), 0),
          1
        )
      : 0;

  const omzetExcl = totaalRij ? getNum(totaalRij[1]) : 0;
  const btw = totaalRij ? getNum(totaalRij[2]) : 0;
  const omzetIncl = totaalRij ? getNum(totaalRij[3]) : 0;
  const aantalTx = kassaRij ? getNum(kassaRij[1]) : 0;

  return {
    jaar,
    omzetInclBtw: Math.round(omzetIncl * 100) / 100,
    omzetExclBtw: Math.round(omzetExcl * 100) / 100,
    btw: Math.round(btw * 100) / 100,
    aantalTransacties: aantalTx,
    gemiddeldeBon:
      aantalTx > 0
        ? Math.round((omzetIncl / aantalTx) * 100) / 100
        : Math.round(gemBonGewogen * 100) / 100,
    itemsPerBon: Math.round(itemsPerBon * 10) / 10,
    omzetPos: kaartRij ? Math.round(getNum(kaartRij[2]) * 100) / 100 : 0,
    omzetContant: contantRij
      ? Math.round(getNum(contantRij[2]) * 100) / 100
      : 0,
    kortingen: kortingRij
      ? Math.round(Math.abs(getNum(kortingRij[3])) * 100) / 100
      : 0,
    bron: "zettle",
  };
}

export function getZettleJaaroverzicht(bedrijf: Bedrijf): JaarOmzet[] {
  if (DEMO_MODE) return [];
  const cwd = process.cwd();
  const resultaten: JaarOmzet[] = [];
  for (const { bestand, jaar } of IZETTLE_BESTANDEN[bedrijf] ?? []) {
    const data = leesJaaroverzicht(path.join(cwd, bestand), jaar);
    if (data && data.omzetInclBtw > 0) resultaten.push(data);
  }
  return resultaten.sort((a, b) => a.jaar - b.jaar);
}

export function getProductLevenshistorie(bedrijf: Bedrijf): ProductLevens[] {
  if (DEMO_MODE) return [];
  const cwd = process.cwd();
  const bestand = PAYPAL_BESTANDEN[bedrijf];
  if (!bestand) return [];
  const rows = leesCellen(path.join(cwd, bestand));
  if (!rows) return [];

  const resultaten: ProductLevens[] = [];
  // Headers staan op rij 6, data begint rij 7
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const naam = String(r[0]);
    // Skip totaalrij en duidelijk test-spam
    if (naam === "Totaal") continue;

    const aantal = getNum(r[5]);
    const omzetIncl = getNum(r[15]);
    if (aantal === 0 && omzetIncl === 0) continue;

    const winst = typeof r[3] === "number" ? (r[3] as number) : null;
    const marge = typeof r[4] === "number" ? (r[4] as number) : null;

    resultaten.push({
      naam,
      variant: r[1] ? String(r[1]) : "",
      categorie: r[2] ? String(r[2]) : "",
      aantalVerkocht: aantal,
      kortingen: Math.round(Math.abs(getNum(r[9])) * 100) / 100,
      omzetExclBtw: Math.round(getNum(r[13]) * 100) / 100,
      btw: Math.round(getNum(r[14]) * 100) / 100,
      omzetInclBtw: Math.round(omzetIncl * 100) / 100,
      winst: winst !== null ? Math.round(winst * 100) / 100 : null,
      winstmarge: marge,
    });
  }

  return resultaten.sort((a, b) => b.omzetInclBtw - a.omzetInclBtw);
}
