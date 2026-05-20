/**
 * Demo API responses voor alle database-afhankelijke routes.
 * Actief wanneer NEXT_PUBLIC_DEMO_MODE=true.
 */

import type { Bedrijf } from "@/lib/sumup";
import { DEMO_MEDEWERKERS } from "./medewerkers";

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export function getDemoLeaderboard(bedrijf: Bedrijf, venster: number) {
  const medewerkers = DEMO_MEDEWERKERS.filter((m) => m.bedrijven.includes(bedrijf));
  const scores = medewerkers.map((m, i) => ({
    medewerkerId: m.id,
    naam: `${m.voornaam} ${m.achternaam}`,
    voornaam: m.voornaam,
    avatar: null,
    totalScore:    Math.round(80 - i * 8 + Math.random() * 10),
    omzetPerUur:   Math.round((45 + Math.random() * 30) * 100) / 100,
    aantalDiensten: Math.floor(venster / 7 * (1.5 + Math.random())),
    gewerktUren:   Math.round((venster / 7 * 6 + Math.random() * 8) * 10) / 10,
    stiptheidsScore: Math.round(85 + Math.random() * 15),
    reviewBijdrage: Math.floor(Math.random() * 5),
    bedrijf,
  }));
  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

// ─── Voorraad ────────────────────────────────────────────────────────────────

const BB_VOORRAAD = [
  { naam: "Koffie bonen (kg)",    eenheid: "kg",   categorie: "koffie",   huidig: 4.2,  drempelLaag: 3,   drempelKritiek: 1.5, kritiek: true  },
  { naam: "Melk (L)",             eenheid: "liter", categorie: "zuivel",   huidig: 18,   drempelLaag: 10,  drempelKritiek: 4,   kritiek: true  },
  { naam: "Ciabatta brood",       eenheid: "stuks", categorie: "brood",    huidig: 24,   drempelLaag: 15,  drempelKritiek: 5,   kritiek: false },
  { naam: "Eieren (doos 30st)",   eenheid: "dozen", categorie: "zuivel",   huidig: 6,    drempelLaag: 4,   drempelKritiek: 2,   kritiek: true  },
  { naam: "Hertog Jan (fust 20L)",eenheid: "fust",  categorie: "bier",     huidig: 2,    drempelLaag: 2,   drempelKritiek: 1,   kritiek: true  },
  { naam: "Huiswijn Rood (doos)", eenheid: "dozen", categorie: "wijn",     huidig: 8,    drempelLaag: 4,   drempelKritiek: 2,   kritiek: false },
  { naam: "Huiswijn Wit (doos)",  eenheid: "dozen", categorie: "wijn",     huidig: 6,    drempelLaag: 4,   drempelKritiek: 2,   kritiek: false },
  { naam: "Servetjes (pak 500st)",eenheid: "pakken",categorie: "horeca",   huidig: 12,   drempelLaag: 5,   drempelKritiek: 2,   kritiek: false },
  { naam: "Suiker sachets (doos)",eenheid: "dozen", categorie: "horeca",   huidig: 3,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Gember siroop (L)",    eenheid: "liter", categorie: "dranken",  huidig: 1.5,  drempelLaag: 2,   drempelKritiek: 0.5, kritiek: false },
];

const SL_VOORRAAD = [
  { naam: "Biefstuk (kg)",        eenheid: "kg",    categorie: "vlees",    huidig: 6.5,  drempelLaag: 5,   drempelKritiek: 2,   kritiek: true  },
  { naam: "Zalmfilet (kg)",       eenheid: "kg",    categorie: "vis",      huidig: 4.0,  drempelLaag: 3,   drempelKritiek: 1.5, kritiek: true  },
  { naam: "Penne pasta (kg)",     eenheid: "kg",    categorie: "droog",    huidig: 8,    drempelLaag: 4,   drempelKritiek: 2,   kritiek: false },
  { naam: "Risotto rijst (kg)",   eenheid: "kg",    categorie: "droog",    huidig: 5,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Champignons (kg)",     eenheid: "kg",    categorie: "groente",  huidig: 3.5,  drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Côtes du Rhône (doos)",eenheid: "dozen", categorie: "wijn",     huidig: 5,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Pinot Grigio (doos)",  eenheid: "dozen", categorie: "wijn",     huidig: 4,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Demi-glace saus (L)",  eenheid: "liter", categorie: "sauzen",   huidig: 2.5,  drempelLaag: 2,   drempelKritiek: 0.5, kritiek: true  },
  { naam: "Room (L)",             eenheid: "liter", categorie: "zuivel",   huidig: 4,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Kaas geraspt (kg)",    eenheid: "kg",    categorie: "zuivel",   huidig: 2.2,  drempelLaag: 2,   drempelKritiek: 0.5, kritiek: false },
];

const KL_VOORRAAD = [
  { naam: "Kroket (vak 48st)",    eenheid: "vakken",categorie: "snacks",   huidig: 3,    drempelLaag: 2,   drempelKritiek: 1,   kritiek: true  },
  { naam: "Bitterballen (zak)",   eenheid: "zakken",categorie: "snacks",   huidig: 5,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: true  },
  { naam: "Burgers (kg)",         eenheid: "kg",    categorie: "vlees",    huidig: 8,    drempelLaag: 5,   drempelKritiek: 2,   kritiek: true  },
  { naam: "Brioche broodjes",     eenheid: "stuks", categorie: "brood",    huidig: 30,   drempelLaag: 20,  drempelKritiek: 8,   kritiek: false },
  { naam: "Heineken (fust 50L)",  eenheid: "fust",  categorie: "bier",     huidig: 2,    drempelLaag: 1,   drempelKritiek: 0,   kritiek: true  },
  { naam: "Fris blik (tray)",     eenheid: "trays", categorie: "fris",     huidig: 6,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Mojito basis (L)",     eenheid: "liter", categorie: "cocktails",huidig: 2.5,  drempelLaag: 2,   drempelKritiek: 0.5, kritiek: false },
  { naam: "Pulled pork (kg)",     eenheid: "kg",    categorie: "vlees",    huidig: 3.5,  drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
  { naam: "Nacho's (zak 1kg)",    eenheid: "zakken",categorie: "snacks",   huidig: 8,    drempelLaag: 4,   drempelKritiek: 2,   kritiek: false },
  { naam: "Jenever (fles 1L)",    eenheid: "flessen",categorie: "spirits", huidig: 4,    drempelLaag: 3,   drempelKritiek: 1,   kritiek: false },
];

const VOORRAAD_PER_BEDRIJF: Record<Bedrijf, typeof BB_VOORRAAD> = {
  bb: BB_VOORRAAD,
  sl: SL_VOORRAAD,
  kl: KL_VOORRAAD,
};

export function getDemoVoorraad(bedrijf: Bedrijf) {
  return VOORRAAD_PER_BEDRIJF[bedrijf].map((p, i) => ({
    id: (bedrijf === "bb" ? 100 : bedrijf === "sl" ? 200 : 300) + i,
    bedrijf,
    naam: p.naam,
    eenheid: p.eenheid,
    categorie: p.categorie,
    huidigNiveau: p.huidig,
    drempelLaag: p.drempelLaag,
    drempelKritiek: p.drempelKritiek,
    kritiekProduct: p.kritiek,
    notitie: null,
    status: p.huidig <= p.drempelKritiek ? "kritiek" : p.huidig <= p.drempelLaag ? "laag" : "ok",
    bijgewerktOp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
  }));
}

// ─── Salaris ─────────────────────────────────────────────────────────────────

export function getDemoSalaris(bedrijf: Bedrijf, jaar: number, maand: number) {
  const medewerkers = DEMO_MEDEWERKERS.filter((m) => m.bedrijven.includes(bedrijf));
  return medewerkers.map((m) => {
    const uren = 60 + Math.round(Math.random() * 50);
    const bruto = Math.round(uren * m.uurloon * 100) / 100;
    const vakantiegeld = Math.round(bruto * 0.0833 * 100) / 100;
    const vakantieUren = Math.round(bruto * 0.08 * 100) / 100;
    const totaal = Math.round((bruto + vakantiegeld + vakantieUren) * 100) / 100;
    return {
      id: m.id * 100 + maand,
      medewerkerId: m.id,
      naam: `${m.voornaam} ${m.achternaam}`,
      voornaam: m.voornaam,
      achternaam: m.achternaam,
      jaar,
      maand,
      brutoUren: uren,
      uurloon: m.uurloon,
      brutoLoon: bruto,
      vakantiegeldPct: 8.33,
      vakantiegeldEur: vakantiegeld,
      vakantieUrenPct: 8.00,
      vakantieUrenEur: vakantieUren,
      totaalEur: totaal,
      status: "open",
      bron: "rooster",
    };
  });
}

// ─── Cashflow ────────────────────────────────────────────────────────────────

export function getDemoCashflow(bedrijf: Bedrijf, dagen: number) {
  const startSaldo = bedrijf === "bb" ? 18500 : bedrijf === "sl" ? 24000 : 12000;
  const dagOmzet = bedrijf === "bb" ? 1400 : bedrijf === "sl" ? 2100 : 900;
  const dagKosten = bedrijf === "bb" ? 1100 : bedrijf === "sl" ? 1700 : 750;

  const punten = [];
  let saldo = startSaldo;

  for (let i = 0; i < dagen; i++) {
    const datum = new Date();
    datum.setDate(datum.getDate() + i);
    const isWeekend = datum.getDay() === 0 || datum.getDay() === 6;
    const omzet = dagOmzet * (isWeekend ? 1.6 : 1.0) * (0.85 + Math.random() * 0.3);
    const kosten = dagKosten * (0.9 + Math.random() * 0.2);
    saldo += omzet - kosten;
    punten.push({
      datum: datum.toISOString().slice(0, 10),
      verwachteOmzet: Math.round(omzet),
      verwachteKosten: Math.round(kosten),
      gesaldeerd: Math.round(saldo),
    });
  }

  return {
    huidigSaldo: startSaldo,
    huidigSaldoOp: new Date().toISOString(),
    punten,
    bedrijf,
  };
}

// ─── Administratie maand ──────────────────────────────────────────────────────

export function getDemoAdministratie(bedrijf: Bedrijf, jaar: number, maand: number) {
  const baseOmzet = bedrijf === "bb" ? 38000 : bedrijf === "sl" ? 58000 : 24000;
  const omzet = Math.round(baseOmzet * (0.85 + Math.random() * 0.3));
  const loonkosten = Math.round(omzet * 0.28);
  const inkoop = Math.round(omzet * 0.32);
  const huur = bedrijf === "bb" ? 3200 : bedrijf === "sl" ? 4500 : 2100;
  const energie = Math.round(600 + Math.random() * 300);
  const overig = Math.round(omzet * 0.05);
  const resultaat = omzet - loonkosten - inkoop - huur - energie - overig;

  return {
    periode: { jaar, maand },
    omzet,
    kosten: { loonkosten, inkoop, huur, energie, overig, totaal: loonkosten + inkoop + huur + energie + overig },
    resultaat,
    marge: Math.round((resultaat / omzet) * 1000) / 10,
    btw: { te_betalen: Math.round(omzet * 0.21 * 0.15), te_vorderen: Math.round(inkoop * 0.21 * 0.8) },
    bedrijf,
  };
}

// ─── Medewerker activiteit ────────────────────────────────────────────────────

export function getDemoMedewerkerActiviteit(bedrijf: Bedrijf) {
  const medewerkers = DEMO_MEDEWERKERS.filter((m) => m.bedrijven.includes(bedrijf));
  return medewerkers.slice(0, 5).map((m) => ({
    medewerkerId: m.id,
    naam: `${m.voornaam} ${m.achternaam}`,
    voornaam: m.voornaam,
    actie: ["ingeklokt", "uitgeklokt", "rooster gewijzigd"][Math.floor(Math.random() * 3)],
    tijdstempel: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    bedrijf,
  }));
}
