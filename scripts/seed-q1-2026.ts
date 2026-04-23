/**
 * Importeert Q1 2026 ING afschriften naar de Vercel KV database.
 * Run: npx tsx scripts/seed-q1-2026.ts
 *
 * Vereist omgevingsvariabelen:
 *   VERCEL_APP_URL=https://dashboardoverview.vercel.app
 *
 * LET OP: bestandsnamen zijn omgewisseld t.o.v. inhoud (gecontroleerd via IBAN):
 *   "Administratie Brunch Q1 afschriften.csv" → IBAN NL45INGB0107197596 = Saté Lounge (sl)
 *   "Administratie SL Q1 afschriften.csv"     → IBAN NL65INGB0100914934 = Brunch & Brew (bb)
 */
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.VERCEL_APP_URL ?? "https://dashboardoverview.vercel.app";

// Bestandsnamen omgewisseld (inhoud bepaalt welk bedrijf het is)
const CSV_BB = path.join(process.cwd(), "Administratie SL Q1 afschriften.csv");   // BB-IBAN
const CSV_SL = path.join(process.cwd(), "Administratie Brunch Q1 afschriften.csv"); // SL-IBAN

async function importeerIng(bedrijf: "bb" | "sl") {
  const bestand = bedrijf === "bb" ? CSV_BB : CSV_SL;
  console.log(`\n[${bedrijf}] ING CSV uploaden: ${path.basename(bestand)}`);

  const buffer = fs.readFileSync(bestand);
  const blob = new Blob([buffer], { type: "text/csv" });
  const form = new FormData();
  form.append("bestand", blob, `q1-2026-${bedrijf}.csv`);

  const res = await fetch(`${BASE_URL}/api/administratie/ing/${bedrijf}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`ING upload mislukt: ${JSON.stringify(data)}`);
  console.log(`[${bedrijf}] ✓ ${data.bericht}`);
  if (data.reviewNodig > 0) console.log(`[${bedrijf}] ⚠️  ${data.reviewNodig} transacties vereisen BTW-controle`);
}

async function herclassificeer(bedrijf: "bb" | "sl") {
  console.log(`\n[${bedrijf}] Herclassificeren (force) voor dga-er / dga-mp5…`);
  const res = await fetch(
    `${BASE_URL}/api/administratie/ing/${bedrijf}?jaar=2026&force=true`,
    { method: "PUT" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Herclassificeer mislukt: ${JSON.stringify(data)}`);
  console.log(`[${bedrijf}] ✓ ${data.bijgewerkt} transacties bijgewerkt, ${data.reviewOver} nog review`);
}

async function main() {
  if (!fs.existsSync(CSV_BB)) throw new Error(`Bestand niet gevonden: ${CSV_BB}`);
  if (!fs.existsSync(CSV_SL)) throw new Error(`Bestand niet gevonden: ${CSV_SL}`);

  console.log(`Importeren Q1 2026 naar ${BASE_URL}…`);

  await importeerIng("bb");
  await importeerIng("sl");

  // Na import: force-herclassificeer zodat dga-er/dga-mp5 correct worden
  await herclassificeer("bb");
  await herclassificeer("sl");

  console.log("\n✓ Klaar! Controleer /administratie/bb en /administratie/sl");
  console.log("  Tip: bekijk per maand of de salarisoverheveling (dag 1-6) correct staat.");
}

main().catch((e) => { console.error(e); process.exit(1); });
