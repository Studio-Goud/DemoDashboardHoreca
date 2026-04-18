import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";

export interface Feestdag {
  datum: Date;
  naam: string;
  type: "feestdag" | "herdenking";
  impact: "hoog" | "middel" | "laag" | "dicht";
}

export interface Vakantie {
  van: Date;
  tot: Date;       // inclusief
  naam: string;
  regio: "noord" | "midden" | "zuid" | "heel-NL";
  impact: "hoog" | "middel";
}

// Paasberekening — algoritme van Gauss/Meeus
function paasDatum(jaar: number): Date {
  const a = jaar % 19;
  const b = Math.floor(jaar / 100);
  const c = jaar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  return new Date(jaar, n - 1, p + 1);
}

function koningsDag(jaar: number): Date {
  const d = new Date(jaar, 3, 27); // 27 april
  // Als 27 april een zondag is wordt Koningsdag gevierd op 26 april
  if (d.getDay() === 0) return new Date(jaar, 3, 26);
  return d;
}

export function feestdagenVoorJaar(jaar: number): Feestdag[] {
  const pasen = paasDatum(jaar);
  const lijst: Feestdag[] = [
    { datum: new Date(jaar, 0, 1), naam: "Nieuwjaarsdag", type: "feestdag", impact: "dicht" },
    { datum: addDays(pasen, -2), naam: "Goede Vrijdag", type: "feestdag", impact: "middel" },
    { datum: pasen, naam: "1e Paasdag", type: "feestdag", impact: "hoog" },
    { datum: addDays(pasen, 1), naam: "2e Paasdag", type: "feestdag", impact: "hoog" },
    { datum: koningsDag(jaar), naam: "Koningsdag", type: "feestdag", impact: "hoog" },
    { datum: new Date(jaar, 4, 5), naam: "Bevrijdingsdag", type: "herdenking", impact: "middel" },
    { datum: addDays(pasen, 39), naam: "Hemelvaartsdag", type: "feestdag", impact: "hoog" },
    { datum: addDays(pasen, 49), naam: "1e Pinksterdag", type: "feestdag", impact: "hoog" },
    { datum: addDays(pasen, 50), naam: "2e Pinksterdag", type: "feestdag", impact: "hoog" },
    { datum: new Date(jaar, 11, 5), naam: "Sinterklaasavond", type: "feestdag", impact: "middel" },
    { datum: new Date(jaar, 11, 25), naam: "1e Kerstdag", type: "feestdag", impact: "dicht" },
    { datum: new Date(jaar, 11, 26), naam: "2e Kerstdag", type: "feestdag", impact: "hoog" },
    { datum: new Date(jaar, 11, 31), naam: "Oudejaarsavond", type: "feestdag", impact: "middel" },
  ];
  return lijst.map((f) => ({ ...f, datum: startOfDay(f.datum) }));
}

// Schoolvakanties — regio Midden (Utrecht/Overijssel deel). Gebruik voor horeca rond Utrecht/
// midden NL. Data uit officiële rijksoverheid.nl publicaties.
const VAKANTIES_MIDDEN: Omit<Vakantie, "regio" | "impact">[] = [
  // 2024
  { van: new Date(2023, 11, 23), tot: new Date(2024, 0, 7),  naam: "Kerstvakantie 2023/24" },
  { van: new Date(2024, 1, 17),  tot: new Date(2024, 1, 25), naam: "Voorjaarsvakantie 2024" },
  { van: new Date(2024, 3, 27),  tot: new Date(2024, 4, 5),  naam: "Meivakantie 2024" },
  { van: new Date(2024, 6, 13),  tot: new Date(2024, 7, 25), naam: "Zomervakantie 2024" },
  { van: new Date(2024, 9, 19),  tot: new Date(2024, 9, 27), naam: "Herfstvakantie 2024" },
  { van: new Date(2024, 11, 21), tot: new Date(2025, 0, 5),  naam: "Kerstvakantie 2024/25" },
  // 2025
  { van: new Date(2025, 1, 22),  tot: new Date(2025, 2, 2),  naam: "Voorjaarsvakantie 2025" },
  { van: new Date(2025, 3, 26),  tot: new Date(2025, 4, 4),  naam: "Meivakantie 2025" },
  { van: new Date(2025, 6, 19),  tot: new Date(2025, 7, 31), naam: "Zomervakantie 2025" },
  { van: new Date(2025, 9, 18),  tot: new Date(2025, 9, 26), naam: "Herfstvakantie 2025" },
  { van: new Date(2025, 11, 20), tot: new Date(2026, 0, 4),  naam: "Kerstvakantie 2025/26" },
  // 2026
  { van: new Date(2026, 1, 21),  tot: new Date(2026, 2, 1),  naam: "Voorjaarsvakantie 2026" },
  { van: new Date(2026, 3, 25),  tot: new Date(2026, 4, 10), naam: "Meivakantie 2026" },
  { van: new Date(2026, 6, 11),  tot: new Date(2026, 7, 23), naam: "Zomervakantie 2026" },
  { van: new Date(2026, 9, 17),  tot: new Date(2026, 9, 25), naam: "Herfstvakantie 2026" },
  { van: new Date(2026, 11, 19), tot: new Date(2027, 0, 3),  naam: "Kerstvakantie 2026/27" },
];

export function alleVakanties(): Vakantie[] {
  return VAKANTIES_MIDDEN.map((v) => ({
    ...v,
    van: startOfDay(v.van),
    tot: startOfDay(v.tot),
    regio: "midden",
    impact: v.naam.startsWith("Zomer") ? "middel" : "hoog",
  }));
}

// Lookup of een datum een feestdag is (exacte match op dag)
export function feestdagOpDatum(d: Date): Feestdag | null {
  const jaar = d.getFullYear();
  for (const f of feestdagenVoorJaar(jaar)) {
    if (isSameDay(f.datum, d)) return f;
  }
  return null;
}

export function vakantieOpDatum(d: Date): Vakantie | null {
  const dag = startOfDay(d).getTime();
  for (const v of alleVakanties()) {
    if (dag >= v.van.getTime() && dag <= v.tot.getTime()) return v;
  }
  return null;
}

export function seizoen(d: Date): "winter" | "lente" | "zomer" | "herfst" {
  const m = d.getMonth(); // 0-11
  if (m <= 1 || m === 11) return "winter"; // dec-jan-feb
  if (m <= 4) return "lente";              // mrt-apr-mei
  if (m <= 7) return "zomer";              // jun-jul-aug
  return "herfst";                          // sep-okt-nov
}

// Komende feestdagen + vakanties vanaf vandaag, gesorteerd op datum
export interface KomendEvent {
  datum: Date;
  naam: string;
  soort: "feestdag" | "vakantie" | "herdenking";
  impact: "hoog" | "middel" | "laag" | "dicht";
  dagenVanNu: number;
  range?: { van: Date; tot: Date };
}

export function komendeEvents(maxDagen = 90): KomendEvent[] {
  const nu = startOfDay(new Date());
  const resultaat: KomendEvent[] = [];
  const grens = addDays(nu, maxDagen);

  for (const jaar of [nu.getFullYear(), nu.getFullYear() + 1]) {
    for (const f of feestdagenVoorJaar(jaar)) {
      if (f.datum >= nu && f.datum <= grens) {
        resultaat.push({
          datum: f.datum,
          naam: f.naam,
          soort: f.type,
          impact: f.impact,
          dagenVanNu: Math.round(
            (f.datum.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24)
          ),
        });
      }
    }
  }

  for (const v of alleVakanties()) {
    // Toon ook vakanties die momenteel lopen
    if (v.tot >= nu && v.van <= grens) {
      resultaat.push({
        datum: v.van,
        naam: v.naam,
        soort: "vakantie",
        impact: v.impact,
        dagenVanNu: Math.round(
          (v.van.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24)
        ),
        range: { van: v.van, tot: v.tot },
      });
    }
  }

  return resultaat.sort((a, b) => a.datum.getTime() - b.datum.getTime());
}
