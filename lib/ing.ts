import * as XLSX from "xlsx";

export type BedrijfSlug = "bb" | "sl" | "kl";

export const BEDRIJF_IBAN: Record<BedrijfSlug, string> = {
  bb: "NL65INGB0100914934",
  sl: "NL45INGB0107197596",
  kl: "", // wordt ingevuld zodra rekening bekend is
};

export interface IngTransactie {
  id: string;
  datum: string; // YYYY-MM-DD
  omschrijving: string;
  tegenrekening: string;
  code: string;
  richting: "debit" | "credit";
  bedrag: number;
  mutatiesoort: string;
  mededelingen: string;
  btw21: number;
  btw9: number;
  categorie: string;
  btwStatus: "auto" | "handmatig" | "review" | "nvt";
}

interface BtwRegel {
  patroon: RegExp;
  tarief21: number; // -1 = auto, 0 = geen, >0 = vast bedrag
  tarief9: number;
  categorie: string;
  status: "auto" | "nvt";
  split9?: number;  // fractie van bedrag tegen 9% (voor gemengde leveranciers)
  split21?: number; // fractie van bedrag tegen 21%
}

// Opgebouwd uit de echte transactiedata van BB + Saté Q1 2026
const BTW_REGELS: BtwRegel[] = [
  // 9% levensmiddelen / horeca-inkoop
  { patroon: /albert\s*heijn/i,            tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /sligro/i,                    tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /hanos/i,                     tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /makro/i,                     tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /harvest\s*coffee/i,          tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /bakkerij\s*havenaar/i,       tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /fleur\s*de\s*caf/i,          tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /tea\s*bar/i,                 tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /south\s*american\s*food/i,   tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /meledi/i,                    tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /pay\.nl\*safe2/i,            tarief21: 0, tarief9: -1, categorie: "levensmiddelen",   status: "auto" },
  { patroon: /johans\s*supermarkt/i,       tarief21: -1, tarief9: 0, categorie: "levensmiddelen",   status: "auto" },
  // South American Food via BCK pin: 80% 9% tarief, 20% 21% tarief
  { patroon: /bck\*south\s*american/i,     tarief21: 0, tarief9: 0, split9: 0.8, split21: 0.2, categorie: "levensmiddelen", status: "auto" },

  // 21% zakelijke diensten / huur / telecom
  { patroon: /klepierre/i,                 tarief21: -1, tarief9: 0, categorie: "huur",             status: "auto" },
  { patroon: /echt\s*rotterdams/i,         tarief21: 0,  tarief9: 0, categorie: "salaris",          status: "nvt"  },
  { patroon: /odido/i,                     tarief21: -1, tarief9: 0, categorie: "telecom",          status: "auto" },
  { patroon: /t-mobile/i,                  tarief21: -1, tarief9: 0, categorie: "telecom",          status: "auto" },
  { patroon: /kpn/i,                       tarief21: -1, tarief9: 0, categorie: "telecom",          status: "auto" },
  { patroon: /one\.com/i,                  tarief21: -1, tarief9: 0, categorie: "hosting",          status: "auto" },
  { patroon: /spotify/i,                   tarief21: -1, tarief9: 0, categorie: "abonnement",       status: "auto" },
  { patroon: /horeca.*platform|horecaontwikkel|stichting\s*horeca/i, tarief21: -1, tarief9: 0, categorie: "software", status: "auto" },
  { patroon: /shiftbase/i,                 tarief21: -1, tarief9: 0, categorie: "software",         status: "auto" },
  { patroon: /directsocials/i,             tarief21: -1, tarief9: 0, categorie: "marketing",        status: "auto" },
  { patroon: /gemeente\s*rotterdam/i,      tarief21: -1, tarief9: 0, categorie: "gemeentekosten",   status: "auto" },
  { patroon: /praxis/i,                    tarief21: -1, tarief9: 0, categorie: "materiaal",        status: "auto" },
  { patroon: /bck\*markthal/i,             tarief21: -1, tarief9: 0, categorie: "markthal",         status: "auto" },
  { patroon: /disposable\s*discounter/i,   tarief21: -1, tarief9: 0, categorie: "materiaal",        status: "auto" },
  { patroon: /fjord\s*eat/i,               tarief21: -1, tarief9: 0, categorie: "representatie",    status: "auto" },
  { patroon: /stofzakkie/i,                tarief21: -1, tarief9: 0, categorie: "representatie",    status: "auto" },
  { patroon: /printerpro/i,                tarief21: -1, tarief9: 0, categorie: "representatie",    status: "auto" },
  { patroon: /action\s+\d|action\s+[a-z]{2,}/i, tarief21: -1, tarief9: 0, categorie: "representatie", status: "auto" },
  { patroon: /bck\*xenos/i,                tarief21: -1, tarief9: 0, categorie: "representatie",    status: "auto" },

  // Geen BTW — verzekering, cash opname, vergoedingen
  { patroon: /surebusiness/i,              tarief21: 0,  tarief9: 0, categorie: "verzekering",      status: "nvt" },
  { patroon: /geldmaat/i,                  tarief21: 0,  tarief9: 0, categorie: "contant",          status: "nvt" },
  { patroon: /via\s*tikkie/i,              tarief21: 0,  tarief9: 0, categorie: "vergoeding",       status: "nvt" },

  // Salaris / personeel — initialen + achternaam patroon (bijv. T COSTA, HL FRANKEN-SNOEI, M DE CARVALHO PINHO BARBOSA)
  { patroon: /^[A-Z]{1,3}\s+(?:(?:de|van|den|der|ter|te|het|in|op|'t)\s+)?[A-Z][A-Z\s-]{1,}$/i, tarief21: 0, tarief9: 0, categorie: "salaris", status: "nvt" },

  // 0% / geen BTW (loonkosten, belasting, pensioenen, banktransfers)
  { patroon: /pensioenfonds/i,             tarief21: 0,  tarief9: 0, categorie: "pensioen",         status: "nvt" },
  { patroon: /belastingdienst/i,           tarief21: 0,  tarief9: 0, categorie: "belasting",        status: "nvt" },
  { patroon: /uwv/i,                       tarief21: 0,  tarief9: 0, categorie: "sociale-lasten",   status: "nvt" },
  { patroon: /kosten\s*zakelijk\s*betalingsverkeer/i, tarief21: 0, tarief9: 0, categorie: "bankkosten", status: "nvt" },

  // Omzet (credit = inkomsten, geen inkoop-BTW)
  { patroon: /sumup/i,                     tarief21: 0,  tarief9: 0, categorie: "omzet",            status: "nvt" },
  { patroon: /zettle|izettle/i,            tarief21: 0,  tarief9: 0, categorie: "omzet",            status: "nvt" },
  { patroon: /paypal/i,                    tarief21: 0,  tarief9: 0, categorie: "omzet",            status: "nvt" },
  { patroon: /primark/i,                   tarief21: 0,  tarief9: 0, categorie: "omzet",            status: "nvt" },
  { patroon: /ing\s*deposit/i,             tarief21: 0,  tarief9: 0, categorie: "deposit",          status: "nvt" },
];

// Bereken BTW: tarief -1 = auto berekenen, split = gemengd tarief
function berekenBtw(bedrag: number, tarief21: number, tarief9: number, split21?: number, split9?: number): { btw21: number; btw9: number } {
  if (split21 !== undefined || split9 !== undefined) {
    const deel21 = bedrag * (split21 ?? 0);
    const deel9  = bedrag * (split9  ?? 0);
    return {
      btw21: rnd(deel21 - deel21 / 1.21),
      btw9:  rnd(deel9  - deel9  / 1.09),
    };
  }
  return {
    btw21: tarief21 === -1 ? rnd(bedrag - bedrag / 1.21) : tarief21,
    btw9:  tarief9  === -1 ? rnd(bedrag - bedrag / 1.09) : tarief9,
  };
}

function rnd(n: number): number {
  return Math.round(n * 100) / 100;
}

function categoriseer(naam: string, bedrag: number): {
  btw21: number; btw9: number; categorie: string; btwStatus: IngTransactie["btwStatus"];
} {
  for (const regel of BTW_REGELS) {
    if (regel.patroon.test(naam)) {
      const { btw21, btw9 } = berekenBtw(bedrag, regel.tarief21, regel.tarief9, regel.split21, regel.split9);
      return { btw21, btw9, categorie: regel.categorie, btwStatus: regel.status };
    }
  }
  return { btw21: 0, btw9: 0, categorie: "onbekend", btwStatus: "review" };
}

function ingDatumNaarIso(d: number | string | unknown): string {
  const s = String(d);
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

function hashId(datum: string, naam: string, bedrag: number): string {
  return `${datum}-${naam.slice(0, 20).replace(/\s/g, "")}-${bedrag}`.replace(/[^a-zA-Z0-9-]/g, "");
}

// Verrijk kolommen: als het bestand al BTW-kolommen heeft (gebruikers-export), gebruik die.
// Zo niet, categoriseer automatisch.
function verwerkRij(row: unknown[]): IngTransactie | null {
  const datum = row[0];
  const naam = String(row[1] ?? "").trim();
  const rekening = String(row[2] ?? "");
  const tegenrekening = String(row[3] ?? "");
  const code = String(row[4] ?? "");
  const richtingRaw = String(row[5] ?? "").toLowerCase();
  const bedragRaw = row[6];
  const bestaandeBtw21 = row[7];
  const bestaandeBtw9 = row[8];
  const mutatiesoort = String(row[9] ?? "");
  const mededelingen = String(row[10] ?? "");

  if (!datum || !naam || bedragRaw === "" || bedragRaw === undefined) return null;

  const richting: "debit" | "credit" = richtingRaw.includes("debit") || richtingRaw === "af" ? "debit" : "credit";
  const bedrag = Math.abs(Number(String(bedragRaw).replace(",", ".")));
  if (isNaN(bedrag) || bedrag === 0) return null;

  const datumIso = ingDatumNaarIso(datum);

  // Gebruik bestaande BTW als aanwezig
  const heeftBestaandeBtw = (bestaandeBtw21 !== "" && bestaandeBtw21 !== undefined && bestaandeBtw21 !== null)
    || (bestaandeBtw9 !== "" && bestaandeBtw9 !== undefined && bestaandeBtw9 !== null);

  let btw21: number, btw9: number, categorie: string, btwStatus: IngTransactie["btwStatus"];

  if (heeftBestaandeBtw) {
    btw21 = rnd(Number(bestaandeBtw21) || 0);
    btw9  = rnd(Number(bestaandeBtw9)  || 0);
    categorie = "handmatig";
    btwStatus = "handmatig";
  } else {
    const cat = categoriseer(naam, bedrag);
    btw21 = cat.btw21;
    btw9  = cat.btw9;
    categorie = cat.categorie;
    btwStatus = cat.btwStatus;
  }

  return {
    id: hashId(datumIso, naam, bedrag),
    datum: datumIso,
    omschrijving: naam,
    tegenrekening,
    code,
    richting,
    bedrag,
    mutatiesoort,
    mededelingen,
    btw21,
    btw9,
    categorie,
    btwStatus,
  };
}

export function parseIngExcel(buffer: Buffer): IngTransactie[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const transacties: IngTransactie[] = [];

  for (const naam of wb.SheetNames) {
    // Sla samenvattings-sheets over
    if (naam.toLowerCase().includes("contant") || naam.toLowerCase().includes("totaal")) continue;

    const ws = wb.Sheets[naam];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

    // Zoek header-rij
    const headerIdx = rows.findIndex(
      (r) => Array.isArray(r) && String(r[0]).toLowerCase().includes("dat") && String(r[1]).toLowerCase().includes("name")
    );
    const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1;

    for (let i = startIdx; i < rows.length; i++) {
      const tx = verwerkRij(rows[i] as unknown[]);
      if (tx) transacties.push(tx);
    }
  }

  // Dedupliceer op id
  const uniek = new Map<string, IngTransactie>();
  for (const tx of transacties) uniek.set(tx.id, tx);
  return Array.from(uniek.values()).sort((a, b) => a.datum.localeCompare(b.datum));
}

export function parseIngCsv(text: string): IngTransactie[] {
  // Standaard ING CSV-export (puntkomma-gescheiden, Nederlandse kolommen)
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const transacties: IngTransactie[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    // Datum;Naam/Omschrijving;Rekening;Tegenrekening;Code;Af Bij;Bedrag (EUR);Mutatiesoort;Mededelingen
    const row = [
      cols[0], cols[1], cols[2], cols[3], cols[4],
      cols[5] === "Af" ? "Debit" : "Credit",
      cols[6], "", "", cols[7], cols[8],
    ];
    const tx = verwerkRij(row);
    if (tx) transacties.push(tx);
  }
  return transacties.sort((a, b) => a.datum.localeCompare(b.datum));
}

// ─── GoCardless transactie → IngTransactie ────────────────────────────────────

import type { GcTransaction } from "./gocardless";

export function vanGcTransactie(gc: GcTransaction): IngTransactie | null {
  const bedragStr = gc.transactionAmount.amount;
  const bedragNum = parseFloat(bedragStr);
  if (isNaN(bedragNum)) return null;

  const richting: "debit" | "credit" = bedragNum < 0 ? "debit" : "credit";
  const bedrag = Math.abs(bedragNum);
  const datum = gc.bookingDate;
  const naam = gc.creditorName ?? gc.debtorName ??
    gc.remittanceInformationUnstructured?.slice(0, 50) ?? "Onbekend";
  const mededelingen = [
    gc.remittanceInformationUnstructured,
    gc.remittanceInformationStructured,
  ].filter(Boolean).join(" ").slice(0, 200);

  const { btw21, btw9, categorie, btwStatus } = categoriseer(naam, bedrag);

  return {
    id: gc.transactionId ?? hashId(datum, naam, bedrag),
    datum,
    omschrijving: naam,
    tegenrekening: "",
    code: gc.bankTransactionCode ?? "",
    richting,
    bedrag,
    mutatiesoort: richting === "credit" ? "Credit" : "Debit",
    mededelingen,
    btw21,
    btw9,
    categorie,
    btwStatus,
  };
}

export function filterMaand(txs: IngTransactie[], jaar: number, maand: number): IngTransactie[] {
  const prefix = `${jaar}-${String(maand).padStart(2, "0")}`;
  return txs.filter((t) => t.datum.startsWith(prefix));
}

export function filterKwartaal(txs: IngTransactie[], jaar: number, kwartaal: 1 | 2 | 3 | 4): IngTransactie[] {
  const start = (kwartaal - 1) * 3 + 1;
  return txs.filter((t) => {
    const [y, m] = t.datum.split("-").map(Number);
    return y === jaar && m >= start && m < start + 3;
  });
}
