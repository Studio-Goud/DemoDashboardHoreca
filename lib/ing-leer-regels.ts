/**
 * Geleerde categorisatie-regels voor ING-transacties.
 *
 * Bij elke manuele review-keuze leren we een patroon: kern-naam van de
 * leverancier → categorie + BTW-tarief. Volgende upload past de regel
 * automatisch toe op alle nieuwe transacties met die leverancier.
 *
 * Opslag: Vercel KV per bedrijf, met de regel-id (lowercase patroon-key)
 * als sleutel binnen een list. Geleerd vanuit:
 * - manuele review (ReviewPanel "Opslaan")
 * - Boekhoud-Agent (AI-categorisatie met hoge confidence)
 *
 * Eigenaar kan via "Vergeet regel" een mistake corrigeren.
 */

import { kv } from "@vercel/kv";

type BedrijfSlug = "bb" | "sl" | "kl";

export interface GeleerdeRegel {
  /** Lowercase patroon-key (eerste herkenbare woorden uit omschrijving) */
  patroon: string;
  /** Categorie zoals in ReviewPanel.CATEGORIEEN */
  categorie: string;
  /** BTW-tarief: 0 / 9 / 21 */
  tarief: 0 | 9 | 21;
  /** Wie heeft de regel geleerd: manueel of AI */
  bron: "manueel" | "ai";
  /** Vertrouwen 0-1 (manueel = 1.0, AI varieert) */
  confidence: number;
  /** ISO-datum van leren */
  gemaaktOp: string;
  /** Hoe vaak deze regel al is toegepast */
  toepassingen: number;
}

function key(bedrijf: BedrijfSlug): string {
  return `adm:ing-leer:${bedrijf}`;
}

/**
 * Extraheer een herkenbare leverancier-key uit een ING-omschrijving.
 *
 * ING-omschrijvingen zijn vaak vrije tekst met code-prefixen en transactie-
 * ids. We pakken de eerste ~30 leesbare tekens en filteren cijfers en
 * korte vulwoorden eruit. Niet perfect maar genoeg voor 90%+ van de
 * gevallen (Albert Heijn, KPN, Sligro, etc.).
 */
export function extracteerPatroon(omschrijving: string): string | null {
  const schoon = omschrijving
    .toLowerCase()
    .replace(/\b\d{4,}\b/g, " ")            // lange cijferreeksen
    .replace(/[^a-zà-ž\s]/gi, " ")          // alleen letters
    .replace(/\b(de|het|een|via|nl|sepa|incasso|ideal|payment|tx|pas|transactie|naar|van|aan|bij|in|op)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (schoon.length < 3) return null;

  // Pak max 3 woorden van min 3 chars
  const woorden = schoon.split(" ").filter((w) => w.length >= 3).slice(0, 3);
  if (woorden.length === 0) return null;
  return woorden.join(" ");
}

export async function geleerdeRegels(bedrijf: BedrijfSlug): Promise<GeleerdeRegel[]> {
  const regels = await kv.get<GeleerdeRegel[]>(key(bedrijf));
  return regels ?? [];
}

/**
 * Sla een regel op of werk hem bij. Idempotent: zelfde patroon overschrijft.
 */
export async function slaRegelOp(
  bedrijf: BedrijfSlug,
  patroon: string,
  categorie: string,
  tarief: 0 | 9 | 21,
  bron: "manueel" | "ai",
  confidence = 1.0,
): Promise<void> {
  if (!patroon || patroon.length < 3) return;
  const huidig = await geleerdeRegels(bedrijf);
  const bestaand = huidig.find((r) => r.patroon === patroon);
  if (bestaand) {
    bestaand.categorie = categorie;
    bestaand.tarief = tarief;
    bestaand.bron = bron;
    bestaand.confidence = confidence;
    bestaand.gemaaktOp = new Date().toISOString();
    // toepassingen blijft staan
  } else {
    huidig.push({
      patroon,
      categorie,
      tarief,
      bron,
      confidence,
      gemaaktOp: new Date().toISOString(),
      toepassingen: 0,
    });
  }
  await kv.set(key(bedrijf), huidig);
}

export async function vergeetRegel(bedrijf: BedrijfSlug, patroon: string): Promise<void> {
  const huidig = await geleerdeRegels(bedrijf);
  const nieuw = huidig.filter((r) => r.patroon !== patroon);
  await kv.set(key(bedrijf), nieuw);
}

/**
 * Vind de eerst-matchende geleerde regel voor een omschrijving.
 * Returnt null als er geen match is.
 *
 * Match-strategie: alle woorden van het patroon moeten voorkomen in de
 * (genormaliseerde) omschrijving. Dat is iets soepeler dan exacte string
 * match — werkt bij "ALBERT HEIJN 1234 ROTTERDAM" → patroon "albert heijn".
 */
export function matchRegel(
  regels: GeleerdeRegel[],
  omschrijving: string,
): GeleerdeRegel | null {
  const normaal = omschrijving.toLowerCase();
  // Langere patronen eerst (specifiek > generiek)
  const gesorteerd = [...regels].sort((a, b) => b.patroon.length - a.patroon.length);
  for (const r of gesorteerd) {
    const woorden = r.patroon.split(" ").filter((w) => w.length >= 3);
    if (woorden.every((w) => normaal.includes(w))) {
      return r;
    }
  }
  return null;
}

/**
 * Verhoog toepassings-teller (na een succesvolle match). Optioneel — niet
 * blokkerend voor de parse-stroom; faalt stil bij KV-fout.
 */
export async function teltToepassing(
  bedrijf: BedrijfSlug,
  patroon: string,
): Promise<void> {
  try {
    const huidig = await geleerdeRegels(bedrijf);
    const r = huidig.find((x) => x.patroon === patroon);
    if (r) {
      r.toepassingen += 1;
      await kv.set(key(bedrijf), huidig);
    }
  } catch {
    // niet kritiek
  }
}
