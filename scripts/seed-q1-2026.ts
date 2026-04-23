/**
 * Importeert Q1 2026 Administratie.xlsx naar de Vercel KV database.
 * Run: npx tsx scripts/seed-q1-2026.ts
 *
 * Vereist omgevingsvariabelen:
 *   VERCEL_APP_URL=https://dashboardoverview.vercel.app
 */
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.VERCEL_APP_URL ?? "https://dashboardoverview.vercel.app";
const EXCEL_BB   = path.join(process.cwd(), "Q1 2026 Administratie BB.xlsx");
const EXCEL_SL   = path.join(process.cwd(), "Q1 2026 Administratie Sate.xlsx");

// Excel datum serial → YYYY-MM-DD
function excelDatumNaarIso(serial: unknown): string | null {
  if (typeof serial !== "number" || isNaN(serial)) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function importeerIng(bedrijf: "bb" | "sl") {
  console.log(`\n[${bedrijf}] ING transacties uploaden…`);
  const buffer = fs.readFileSync(bedrijf === "bb" ? EXCEL_BB : EXCEL_SL);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const form = new FormData();
  form.append("bestand", blob, "Q1 2026 Administratie.xlsx");

  const res = await fetch(`${BASE_URL}/api/administratie/ing/${bedrijf}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`ING upload mislukt: ${JSON.stringify(data)}`);
  console.log(`[${bedrijf}] ✓ ING: ${data.bericht}`);
  if (data.reviewNodig > 0) console.log(`[${bedrijf}] ⚠️ ${data.reviewNodig} review items`);
}

async function importeerContant(bedrijf: "bb" | "sl") {
  console.log(`\n[${bedrijf}] Contant transacties importeren…`);
  const wb = XLSX.readFile(bedrijf === "bb" ? EXCEL_BB : EXCEL_SL);
  const ws = wb.Sheets["Contant"];
  if (!ws) { console.log(`[${bedrijf}] Geen Contant sheet gevonden`); return; }

  const rijen = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  let verwerkt = 0;

  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    const datum = excelDatumNaarIso(rij[0]);
    const omschrijving = String(rij[1] ?? "").trim();
    const bedrag = Number(rij[2]);
    const btw21 = Number(rij[3] ?? 0) || 0;
    const btw9  = Number(rij[4] ?? 0) || 0;

    // Sla lege rijen en totaalrijen over
    if (!omschrijving || !bedrag || isNaN(bedrag)) continue;

    // Gebruik huidige datum als geen datum (bijv. "MP5" rijen)
    const datumStr = datum ?? new Date().toISOString().slice(0, 10);

    const res = await fetch(`${BASE_URL}/api/administratie/contant/${bedrijf}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum: datumStr,
        omschrijving,
        bedrag,
        btw21,
        btw9,
        type: "uitgave",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn(`[${bedrijf}] ⚠️ Contant rij ${i} mislukt: ${JSON.stringify(data)}`);
    } else {
      console.log(`[${bedrijf}] ✓ Contant: ${datumStr} ${omschrijving} €${bedrag}`);
      verwerkt++;
    }
  }
  console.log(`[${bedrijf}] ✓ ${verwerkt} contante transacties geïmporteerd`);
}

async function main() {
  if (!fs.existsSync(EXCEL_BB)) throw new Error(`Excel niet gevonden: ${EXCEL_BB}`);
  if (!fs.existsSync(EXCEL_SL)) throw new Error(`Excel niet gevonden: ${EXCEL_SL}`);
  console.log(`Importeren Q1 2026 naar ${BASE_URL}…`);

  await importeerIng("bb");
  await importeerContant("bb");

  await importeerIng("sl");
  await importeerContant("sl");

  console.log("\n✓ Klaar! Controleer /administratie/bb en /administratie/sl");
}

main().catch((e) => { console.error(e); process.exit(1); });
