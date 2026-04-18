import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

export interface JaarOmzet {
  jaar: number;
  omzetInclBtw: number;
  aantalTransacties: number;
  gemiddeldeBon: number;
  bron: "zettle";
}

const BESTANDEN: Record<string, Array<{ bestand: string; jaar: number }>> = {
  bb: [
    { bestand: "Izettle Brunch & Brew-20230101-20231231.xlsx", jaar: 2023 },
    { bestand: "Izettle Brunch & Brew-20240101-20241231.xlsx", jaar: 2024 },
    { bestand: "Izettle Brunch & Brew-20250101-20251231.xlsx", jaar: 2025 },
  ],
  sl: [
    { bestand: "Izettle Sate Lounge - 20240101-20241231 (1).xlsx", jaar: 2024 },
    { bestand: "Izettle Sate Lounge 20250101-20251231 (1).xlsx", jaar: 2025 },
  ],
};

function leesJaaroverzicht(bestandspad: string, jaar: number): JaarOmzet | null {
  try {
    const wb = XLSX.readFile(bestandspad);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

    // Zoek totaalrij met omzet incl. BTW
    const totaalRij = data.find(
      (r) => r[0] === "Totaal" && typeof r[3] === "number" && (r[3] as number) > 0
    );
    // Zoek kassasysteem rij voor aantal transacties
    const kassaRij = data.find(
      (r) => r[0] === "Kassasysteem" && typeof r[1] === "number"
    );

    const omzet = totaalRij ? (totaalRij[3] as number) : 0;
    const aantalTx = kassaRij ? (kassaRij[1] as number) : 0;

    return {
      jaar,
      omzetInclBtw: omzet,
      aantalTransacties: aantalTx,
      gemiddeldeBon: aantalTx > 0 ? Math.round((omzet / aantalTx) * 100) / 100 : 0,
      bron: "zettle",
    };
  } catch {
    return null;
  }
}

export function getZettleJaaroverzicht(bedrijf: "bb" | "sl"): JaarOmzet[] {
  const cwd = process.cwd();
  const resultaten: JaarOmzet[] = [];

  for (const { bestand, jaar } of BESTANDEN[bedrijf] ?? []) {
    const volledigPad = path.join(cwd, bestand);
    if (!fs.existsSync(volledigPad)) continue;
    const data = leesJaaroverzicht(volledigPad, jaar);
    if (data) resultaten.push(data);
  }

  return resultaten.sort((a, b) => a.jaar - b.jaar);
}
