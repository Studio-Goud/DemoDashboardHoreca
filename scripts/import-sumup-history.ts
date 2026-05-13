/**
 * Eenmalig: alle historische SumUp-transacties syncen naar Postgres.
 *
 * Run via:  npm run import:sumup
 *
 * Default: 2 jaar terug. Kan via SUMUP_VANAF env aangepast (ISO datum).
 * Idempotent — kan veilig opnieuw gedraaid worden.
 */
import { syncBedrijf } from "../lib/sumup-sync";
import type { Bedrijf } from "../lib/sumup";

const VANAF = process.env.SUMUP_VANAF ?? (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString();
})();

const BEDRIJVEN: Bedrijf[] = ["bb", "sl", "kl"];

async function main() {
  console.log(`→ Historische SumUp import vanaf ${VANAF}`);
  console.log("");

  for (const b of BEDRIJVEN) {
    const start = Date.now();
    console.log(`→ ${b.toUpperCase()} synchroniseren...`);
    const result = await syncBedrijf(b, VANAF);
    const duurSec = ((Date.now() - start) / 1000).toFixed(1);
    if (result.fout) {
      console.log(`   ❌ Fout: ${result.fout}`);
    } else {
      console.log(`   ✓ Opgehaald: ${result.opgehaaldRaw} · Ingevoegd: ${result.ingevoegd} · ${duurSec}s`);
    }
    console.log("");
  }

  console.log("✅ Klaar.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
