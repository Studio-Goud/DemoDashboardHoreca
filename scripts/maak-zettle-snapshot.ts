/**
 * Genereer een statische snapshot van alle Zettle purchases voor beide
 * bedrijven. Deze snapshot wordt in data/zettle-snapshot-{bb,sl}.json
 * weggeschreven zodat de app bij een cold start niet meer de volledige
 * historie via de Zettle API hoeft te pagineren.
 *
 * Gebruik:
 *   npx tsx scripts/maak-zettle-snapshot.ts
 *
 * Vereist .env.local met:
 *   ZETTLE_CLIENT_ID_BB=...
 *   ZETTLE_TOKEN_BB=...
 *   ZETTLE_CLIENT_ID_SL=...
 *   ZETTLE_TOKEN_SL=...
 *
 * Draai dit script periodiek (bv. 1× per maand) om de snapshot bij te
 * werken. Commit daarna de gewijzigde JSON-files en push.
 */

import fs from "node:fs";
import path from "node:path";

// Simpele .env.local loader (vermijdt dotenv-dep)
function laadEnv(bestand: string) {
  try {
    const inhoud = fs.readFileSync(bestand, "utf-8");
    for (const regel of inhoud.split("\n")) {
      const m = regel.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, sleutel, ruwe] = m;
      const waarde = ruwe.replace(/^["'](.*)["']$/, "$1");
      if (!process.env[sleutel]) process.env[sleutel] = waarde;
    }
  } catch {
    /* bestand bestaat niet — geen probleem */
  }
}

laadEnv(path.join(process.cwd(), ".env.local"));
laadEnv(path.join(process.cwd(), ".env"));

async function main() {
  // Dynamisch importeren NA het laden van de env
  const { fetchZettleVolledig } = await import("../lib/zettle");

  const bedrijven = ["bb", "sl", "kl"] as const;
  for (const bedrijf of bedrijven) {
    console.log(
      `\n→ Zettle ${bedrijf.toUpperCase()}: ophalen volledige historie…`
    );
    const start = Date.now();
    let purchasesRuw: Awaited<ReturnType<typeof fetchZettleVolledig>>;
    try {
      purchasesRuw = await fetchZettleVolledig(bedrijf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Fout bij ${bedrijf}: ${msg}`);
      continue;
    }
    const duurSec = ((Date.now() - start) / 1000).toFixed(1);

    // Strip tot enkel de velden die de app daadwerkelijk leest. Zettle
    // retourneert ruim 25 velden per purchase waarvan we er 4 nodig hebben.
    // Door zelf te mappen blijft de JSON klein genoeg voor Git (<100 MB).
    const purchases = purchasesRuw
      .filter((p) => !p.refund)
      .map((p) => ({
        purchaseUUID: p.purchaseUUID,
        timestamp: p.timestamp,
        amount: Number(p.amount),
        vatAmount: Number(p.vatAmount) || 0,
        currency: p.currency ?? "EUR",
        refund: false,
        products: (p.products ?? []).map((prod) => ({
          name: prod.name,
          unitPrice: Number(prod.unitPrice) || 0,
          quantity: Number(prod.quantity) || 0,
        })),
      }));

    const laatsteTimestamp = purchases.reduce<string>(
      (max, p) => (p.timestamp > max ? p.timestamp : max),
      ""
    );
    const totaalOmzet = purchases.reduce(
      (s, p) => s + Number(p.amount) / 100,
      0
    );

    const snapshot = {
      bedrijf,
      gegenereerd: new Date().toISOString(),
      laatsteTimestamp: laatsteTimestamp || null,
      aantal: purchases.length,
      purchases,
    };

    const pad = path.join(
      process.cwd(),
      "data",
      `zettle-snapshot-${bedrijf}.json`
    );
    fs.writeFileSync(pad, JSON.stringify(snapshot));

    const sizeMB = (fs.statSync(pad).size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ ${purchases.length.toLocaleString("nl-NL")} purchases (${duurSec}s, ${sizeMB} MB)`);
    console.log(`    Totale omzet: €${totaalOmzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`);
    console.log(`    Laatste: ${laatsteTimestamp}`);
    console.log(`    → ${pad}`);
  }

  console.log(
    "\nKlaar! Commit en push de gewijzigde JSON-files om de snapshot live te zetten."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
