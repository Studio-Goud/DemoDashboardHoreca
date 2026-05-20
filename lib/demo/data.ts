/**
 * Demo data generator voor de DemoDashboardHoreca presentatie.
 *
 * Genereert realistische horeca-transacties voor 3 fictieve bedrijven:
 *   bb = Grand Café De Zon (Amsterdam)
 *   sl = Brasserie Noord (Rotterdam)
 *   kl = Bar & Kitchen West (Utrecht)
 *
 * Actief wanneer NEXT_PUBLIC_DEMO_MODE=true.
 */

import type { SumUpTransaction } from "@/lib/sumup";
import type { Bedrijf } from "@/lib/sumup";

// ─── Seeded pseudorandom ─────────────────────────────────────────────────────

function maakRng(seed: number) {
  let s = seed >>> 0;
  return function rng(): number {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0x100000000;
  };
}

// ─── Fictieve bedrijfsinstellingen ───────────────────────────────────────────

interface Configuratie {
  naam: string;
  stad: string;
  gem_dag_laag: number;   // typische omzet rustige dag
  gem_dag_hoog: number;   // typische omzet drukke dag
  gesloten_weekdag: number | null; // null = altijd open, 1=ma, 2=di etc
  open_uur: number;
  sluit_uur: number;
  piek1_uur: number;      // 1e piekuur (lunch/brunch)
  piek2_uur: number;      // 2e piekuur (diner/borrel)
  gem_bon: number;        // gemiddelde transactiebedrag
  producten: Array<{ name: string; price: number; categorie: string }>;
}

const BB_CONFIG: Configuratie = {
  naam: "Grand Café De Zon",
  stad: "Amsterdam",
  gem_dag_laag: 900,
  gem_dag_hoog: 2800,
  gesloten_weekdag: null,
  open_uur: 9,
  sluit_uur: 23,
  piek1_uur: 11,
  piek2_uur: 17,
  gem_bon: 22,
  producten: [
    { name: "Cappuccino", price: 4.00, categorie: "drank" },
    { name: "Koffie", price: 3.50, categorie: "drank" },
    { name: "Latte Macchiato", price: 4.50, categorie: "drank" },
    { name: "Vers Sinaasappelsap", price: 5.50, categorie: "drank" },
    { name: "Spa Blauw", price: 3.00, categorie: "drank" },
    { name: "Hertog Jan 0.5L", price: 5.50, categorie: "drank" },
    { name: "Wijn Rood (glas)", price: 7.50, categorie: "drank" },
    { name: "Wijn Wit (glas)", price: 7.50, categorie: "drank" },
    { name: "Club Sandwich", price: 14.50, categorie: "eten" },
    { name: "Eggs Benedict", price: 14.00, categorie: "eten" },
    { name: "Tosti Ham/Kaas", price: 8.50, categorie: "eten" },
    { name: "Uitsmijter", price: 11.50, categorie: "eten" },
    { name: "Salade Niçoise", price: 16.50, categorie: "eten" },
    { name: "Bitterballen (10x)", price: 10.00, categorie: "borrel" },
    { name: "Kaasplank", price: 18.50, categorie: "borrel" },
    { name: "Bruschetta", price: 9.50, categorie: "borrel" },
  ],
};

const SL_CONFIG: Configuratie = {
  naam: "Brasserie Noord",
  stad: "Rotterdam",
  gem_dag_laag: 1400,
  gem_dag_hoog: 4200,
  gesloten_weekdag: 1, // gesloten op maandag
  open_uur: 12,
  sluit_uur: 22,
  piek1_uur: 12,
  piek2_uur: 19,
  gem_bon: 38,
  producten: [
    { name: "Carpaccio", price: 14.50, categorie: "voorgerecht" },
    { name: "Burrata", price: 13.50, categorie: "voorgerecht" },
    { name: "Dagsoep", price: 7.50, categorie: "voorgerecht" },
    { name: "Biefstuk (200gr)", price: 32.50, categorie: "hoofdgerecht" },
    { name: "Zalmfilet", price: 26.50, categorie: "hoofdgerecht" },
    { name: "Pasta Carbonara", price: 19.50, categorie: "hoofdgerecht" },
    { name: "Risotto Champignon", price: 21.00, categorie: "hoofdgerecht" },
    { name: "Dagmenu 2-gangen", price: 29.50, categorie: "dagmenu" },
    { name: "Dagmenu 3-gangen", price: 37.50, categorie: "dagmenu" },
    { name: "Tiramisu", price: 8.50, categorie: "dessert" },
    { name: "Crème Brûlée", price: 8.00, categorie: "dessert" },
    { name: "Pinot Grigio (glas)", price: 8.50, categorie: "wijn" },
    { name: "Côtes du Rhône (glas)", price: 8.50, categorie: "wijn" },
    { name: "Karaf Wijn Wit", price: 26.00, categorie: "wijn" },
    { name: "Karaf Wijn Rood", price: 28.00, categorie: "wijn" },
    { name: "Heineken 0.3L", price: 4.50, categorie: "bier" },
    { name: "Espresso", price: 3.00, categorie: "koffie" },
  ],
};

const KL_CONFIG: Configuratie = {
  naam: "Bar & Kitchen West",
  stad: "Utrecht",
  gem_dag_laag: 600,
  gem_dag_hoog: 1800,
  gesloten_weekdag: 2, // gesloten op dinsdag
  open_uur: 11,
  sluit_uur: 24,
  piek1_uur: 12,
  piek2_uur: 20,
  gem_bon: 16,
  producten: [
    { name: "Kroket (los)", price: 3.50, categorie: "snack" },
    { name: "Kroket Broodje", price: 5.50, categorie: "snack" },
    { name: "Bitterballen (5x)", price: 6.50, categorie: "snack" },
    { name: "Frikandel Speciaal", price: 4.50, categorie: "snack" },
    { name: "Kaassoufflé", price: 3.00, categorie: "snack" },
    { name: "Hamburger Deluxe", price: 16.50, categorie: "gerecht" },
    { name: "Cheeseburger", price: 14.50, categorie: "gerecht" },
    { name: "Nacho's", price: 11.50, categorie: "gerecht" },
    { name: "Pulled Pork Broodje", price: 13.50, categorie: "gerecht" },
    { name: "Heineken 0.5L", price: 6.00, categorie: "bier" },
    { name: "Radler 0.5L", price: 5.50, categorie: "bier" },
    { name: "Cocktail Mojito", price: 12.50, categorie: "cocktail" },
    { name: "Cocktail Aperol Spritz", price: 11.50, categorie: "cocktail" },
    { name: "Jenever", price: 3.50, categorie: "spirits" },
    { name: "Shotje", price: 3.50, categorie: "spirits" },
    { name: "Cola/Fanta (blik)", price: 3.00, categorie: "fris" },
  ],
};

const CONFIGURATIES: Record<Bedrijf, Configuratie> = {
  bb: BB_CONFIG,
  sl: SL_CONFIG,
  kl: KL_CONFIG,
};

// ─── Seizoens- en weekdagfactoren ────────────────────────────────────────────

// Weekdag (0=zo, 1=ma, ... 6=za)
const WEEKDAG_FACTOR = [1.1, 0.65, 0.75, 0.85, 0.95, 1.55, 1.45];

// Maand (0=jan ... 11=dec) — horeca patroon NL
const MAAND_FACTOR = [0.75, 0.80, 0.90, 1.00, 1.10, 1.25, 1.30, 1.25, 1.10, 1.00, 0.90, 1.20];

// Groei per jaar (2023 = baseline)
const JAAR_GROEI: Record<number, number> = {
  2023: 1.00,
  2024: 1.08,
  2025: 1.15,
  2026: 1.20,
};

// ─── Uur-verdeling ───────────────────────────────────────────────────────────

function uurGewicht(uur: number, piek1: number, piek2: number): number {
  const g1 = Math.exp(-0.5 * ((uur - piek1) / 1.8) ** 2);
  const g2 = Math.exp(-0.5 * ((uur - piek2) / 2.0) ** 2);
  return g1 + g2 * 0.9;
}

// ─── Hoofd-generator ─────────────────────────────────────────────────────────

let cacheTransacties: Partial<Record<Bedrijf, SumUpTransaction[]>> = {};

export function getDemoTransacties(bedrijf: Bedrijf): SumUpTransaction[] {
  if (cacheTransacties[bedrijf]) return cacheTransacties[bedrijf]!;

  const cfg = CONFIGURATIES[bedrijf];
  const rng = maakRng(
    bedrijf === "bb" ? 0xbb1234 :
    bedrijf === "sl" ? 0x5a7e00 : 0xc0c0c0
  );

  const txs: SumUpTransaction[] = [];
  const start = new Date(2023, 0, 1);
  const einde = new Date(); // tot vandaag

  let txIdTeller = 1;
  const cur = new Date(start);

  while (cur <= einde) {
    const weekdag = cur.getDay(); // 0=zo...6=za
    const maand = cur.getMonth();
    const jaar = cur.getFullYear();

    // Gesloten?
    if (cfg.gesloten_weekdag !== null && weekdag === cfg.gesloten_weekdag % 7) {
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    // Doeldagomzet bepalen
    const basisOmzet = cfg.gem_dag_laag + rng() * (cfg.gem_dag_hoog - cfg.gem_dag_laag);
    const factor =
      WEEKDAG_FACTOR[weekdag] *
      MAAND_FACTOR[maand] *
      (JAAR_GROEI[jaar] ?? 1.2) *
      (0.85 + rng() * 0.30); // dagelijkse ruis

    const doelOmzet = basisOmzet * factor;
    const aantalTx = Math.round(doelOmzet / cfg.gem_bon) + Math.floor(rng() * 5);

    // Verdelings-gewichten per uur
    const uren = Array.from({ length: cfg.sluit_uur - cfg.open_uur }, (_, i) => cfg.open_uur + i);
    const gewichten = uren.map((u) => uurGewicht(u, cfg.piek1_uur, cfg.piek2_uur));
    const totaalGewicht = gewichten.reduce((a, b) => a + b, 0);

    // Genereer transacties
    const datumStr = cur.toISOString().slice(0, 10);

    for (let i = 0; i < aantalTx; i++) {
      // Kies een uur op basis van gewichten
      let kies = rng() * totaalGewicht;
      let gekozenIndex = 0;
      for (let j = 0; j < gewichten.length; j++) {
        kies -= gewichten[j];
        if (kies <= 0) { gekozenIndex = j; break; }
      }
      const uur = uren[gekozenIndex];
      const min = Math.floor(rng() * 60);
      const sec = Math.floor(rng() * 60);

      const timestamp = `${datumStr}T${String(uur).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}+02:00`;

      // Kies 1-4 producten per transactie
      const nProducenten = 1 + Math.floor(rng() * 3.5);
      const products: Array<{ name: string; price: number; quantity: number }> = [];
      let totaal = 0;

      for (let p = 0; p < nProducenten; p++) {
        const prodIndex = Math.floor(rng() * cfg.producten.length);
        const prod = cfg.producten[prodIndex];
        const hoeveelheid = rng() < 0.85 ? 1 : 2;
        const bestaand = products.find((x) => x.name === prod.name);
        if (bestaand) {
          bestaand.quantity += hoeveelheid;
        } else {
          products.push({ name: prod.name, price: prod.price, quantity: hoeveelheid });
        }
        totaal += prod.price * hoeveelheid;
      }

      // Afronden op 2 decimalen
      totaal = Math.round(totaal * 100) / 100;
      if (totaal < 2) totaal = 2;

      txs.push({
        id: `DEMO-${bedrijf.toUpperCase()}-${String(txIdTeller).padStart(6, "0")}`,
        transaction_code: `T${String(txIdTeller).padStart(8, "0")}`,
        amount: totaal,
        currency: "EUR",
        timestamp,
        status: "SUCCESSFUL",
        payment_type: rng() < 0.85 ? "ECOM" : "CASH",
        products,
      });

      txIdTeller++;
    }

    cur.setDate(cur.getDate() + 1);
  }

  // Sorteer op timestamp descending (nieuwste eerst, zoals SumUp API)
  txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  cacheTransacties[bedrijf] = txs;
  return txs;
}

// Reset cache (handig bij hot-reload in dev)
export function resetDemoCache(): void {
  cacheTransacties = {};
}
