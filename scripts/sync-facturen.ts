/**
 * Draait via GitHub Actions (dagelijks 07:00 NL tijd).
 * Verbindt met One.com IMAP, downloadt PDF facturen,
 * parseert ze met Claude AI en stuurt ze naar Vercel KV.
 */
import { haalFactuurPdfs, oneComConfig } from "../lib/imap-facturen";
import { parseFactuurPdf } from "../lib/factuur-ai";

const BEDRIJVEN = ["bb", "sl", "kl"] as const;
type BedrijfSlug = typeof BEDRIJVEN[number];

const VERCEL_URL = process.env.VERCEL_APP_URL ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Haal facturen op vanaf Q2 2026 (Q1 is ingediend)
const SINDS_DATUM = new Date("2026-04-01");

function getConfig(bedrijf: BedrijfSlug) {
  const prefix = bedrijf.toUpperCase();
  const user = process.env[`EMAIL_USER_${prefix}`];
  const pass = process.env[`EMAIL_PASS_${prefix}`];
  if (!user || !pass) return null;
  return oneComConfig(user, pass);
}

async function syncBedrijf(bedrijf: BedrijfSlug) {
  const config = getConfig(bedrijf);
  if (!config) {
    console.log(`[${bedrijf}] Geen email config — overgeslagen`);
    return;
  }

  console.log(`[${bedrijf}] IMAP verbinden met ${config.host}…`);
  const ruwe = await haalFactuurPdfs(config, SINDS_DATUM);
  console.log(`[${bedrijf}] ${ruwe.length} PDF(s) gevonden`);

  if (ruwe.length === 0) return;

  const facturen = [];
  for (let i = 0; i < ruwe.length; i += 3) {
    const batch = ruwe.slice(i, i + 3);
    const parsed = await Promise.all(batch.map((r) => parseFactuurPdf(r)));
    facturen.push(...parsed);
    console.log(`[${bedrijf}] ${facturen.length}/${ruwe.length} facturen geparseeerd`);
  }

  // Stuur naar Vercel
  const res = await fetch(`${VERCEL_URL}/api/cron/facturen-opslaan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ bedrijf, facturen }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel opslaan mislukt voor ${bedrijf}: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log(`[${bedrijf}] ✓ Opgeslagen: ${data.opgeslagen} facturen`);
}

async function main() {
  if (!VERCEL_URL) throw new Error("VERCEL_APP_URL ontbreekt");
  if (!CRON_SECRET) throw new Error("CRON_SECRET ontbreekt");

  let fout = false;
  for (const bedrijf of BEDRIJVEN) {
    try {
      await syncBedrijf(bedrijf);
    } catch (err) {
      console.error(`[${bedrijf}] FOUT:`, err);
      fout = true;
    }
  }

  process.exit(fout ? 1 : 0);
}

main();
