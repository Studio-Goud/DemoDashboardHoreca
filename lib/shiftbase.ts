import fs from "fs";
import path from "path";

export interface DienstRegel {
  naam: string;
  datum: string;    // YYYY-MM-DD
  weekdag: number;  // 0=zo 1=ma 2=di 3=wo 4=do 5=vr 6=za
  start: string;    // HH:MM
  eind: string;     // HH:MM
  uren: number;
  bedrijf: "bb" | "sl" | "kl" | null;
}

export interface BezettingPerDag {
  datum: string;
  weekdag: number;
  aantalMensen: number;
  totaalUren: number;
}

export interface BezettingPerWeekdag {
  weekdag: number;    // 0=zo..6=za
  label: string;
  gemMensen: number;
  gemUren: number;
}

// Bekende medewerkers → bedrijf mapping (op basis van periode-overzicht)
const MEDEWERKER_BEDRIJF: Record<string, "bb" | "sl" | "kl"> = {
  "Denise Tuncel":            "bb",
  "Sophie van Nieuwenhoven":  "bb",
  "Hannah Kaya":              "bb",
  "Radha Matahoera":          "sl",
  "Luna Broeders":            "sl",
  "Jikke Maat":               "sl",
  "Kevin Itjoe":              "sl",
  "Bele de Bruin":            "kl",
  "Naemi Yonathan":           "kl",
  "Gianni Gasparinetti":      "kl",
};

const DAG_NAMEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const DAG_LABELS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

function csvDagNaarWeekdag(dag: string): number {
  const idx = DAG_NAMEN.indexOf(dag.trim().toLowerCase());
  return idx >= 0 ? idx : -1;
}

function parseUren(start: string, eind: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = eind.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, mins / 60);
}

// Parse CSV en retourneer alle dienstregel
function parseDiensten(): DienstRegel[] {
  const filePath = path.join(process.cwd(), "data", "shiftbase-diensten.csv");
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").slice(1); // skip header

  const result: DienstRegel[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Format: "Naam",YYYY-MM-DD,dag,HH:MM:SS,HH:MM:SS
    const match = trimmed.match(
      /^"([^"]*)",(\d{4}-\d{2}-\d{2}),(\w+),(\d{2}:\d{2}):\d{2},(\d{2}:\d{2}):\d{2}/
    );
    if (!match) continue;

    const [, naam, datum, dag, start, eind] = match;
    const weekdag = csvDagNaarWeekdag(dag);
    if (weekdag < 0) continue;

    result.push({
      naam,
      datum,
      weekdag,
      start,
      eind,
      uren: parseUren(start, eind),
      bedrijf: MEDEWERKER_BEDRIJF[naam] ?? null,
    });
  }
  return result;
}

// Headcount per datum (unieke namen per dag)
export function bezettingPerDag(): BezettingPerDag[] {
  const diensten = parseDiensten();

  const perDag = new Map<string, { namen: Set<string>; uren: number; weekdag: number }>();
  for (const d of diensten) {
    const entry = perDag.get(d.datum) ?? { namen: new Set(), uren: 0, weekdag: d.weekdag };
    entry.namen.add(d.naam);
    entry.uren += d.uren;
    perDag.set(d.datum, entry);
  }

  return Array.from(perDag.entries())
    .map(([datum, v]) => ({
      datum,
      weekdag: v.weekdag,
      aantalMensen: v.namen.size,
      totaalUren: Math.round(v.uren * 10) / 10,
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

// Gemiddelde bezetting per weekdag (0=zo..6=za)
export function bezettingPerWeekdag(): BezettingPerWeekdag[] {
  const dagen = bezettingPerDag();

  const perWd = new Map<number, { mensen: number[]; uren: number[] }>();
  for (const d of dagen) {
    const entry = perWd.get(d.weekdag) ?? { mensen: [], uren: [] };
    entry.mensen.push(d.aantalMensen);
    entry.uren.push(d.totaalUren);
    perWd.set(d.weekdag, entry);
  }

  return Array.from(perWd.entries())
    .map(([wd, v]) => ({
      weekdag: wd,
      label: DAG_LABELS[wd],
      gemMensen: Math.round((v.mensen.reduce((s, x) => s + x, 0) / v.mensen.length) * 10) / 10,
      gemUren: Math.round((v.uren.reduce((s, x) => s + x, 0) / v.uren.length) * 10) / 10,
    }))
    .sort((a, b) => a.weekdag - b.weekdag);
}

export interface TypischeShift {
  start: string;   // "09:30"
  eind: string;    // "15:00"
  uren: number;    // shift-duur in uren
  freq: number;    // hoe vaak gezien in historische data
}

export interface WeekdagShiftProfiel {
  weekdag: number;
  label: string;
  gemMensen: number;  // gem. aantal unieke mensen die dag
  shifts: TypischeShift[];  // top shifts op basis van frequentie
}

// Rond minuten op naar dichtsbijzijnde 15 min
function roundTo15(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const rounded = Math.round(m / 15) * 15;
  const finalH = h + Math.floor(rounded / 60);
  const finalM = rounded % 60;
  return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
}

// Meest voorkomende shift-slots per weekdag (uit historische diensten)
export function typischeShiftsPerWeekdag(): WeekdagShiftProfiel[] {
  const diensten = parseDiensten();

  // Groepeer per weekdag
  const perWd = new Map<number, {
    namen: Map<string, Set<string>>;  // datum → namen
    slots: Map<string, number>;       // "09:30-15:00" → freq
  }>();

  for (const d of diensten) {
    if (d.naam === "Anonymous User") continue; // skip anoniem
    const wd = d.weekdag;
    if (!perWd.has(wd)) perWd.set(wd, { namen: new Map(), slots: new Map() });
    const entry = perWd.get(wd)!;

    // Unieke mensen per datum (voor gem berekening)
    const namenOpDag = entry.namen.get(d.datum) ?? new Set<string>();
    namenOpDag.add(d.naam);
    entry.namen.set(d.datum, namenOpDag);

    // Shift-slot (afgerond op 15 min)
    const key = `${roundTo15(d.start)}-${roundTo15(d.eind)}`;
    entry.slots.set(key, (entry.slots.get(key) ?? 0) + 1);
  }

  return Array.from(perWd.entries())
    .map(([wd, v]) => {
      // Gem. unieke mensen per dag
      const aantalDagen = v.namen.size;
      const totaalMensen = Array.from(v.namen.values()).reduce((s, namen) => s + namen.size, 0);
      const gemMensen = aantalDagen > 0 ? Math.round((totaalMensen / aantalDagen) * 10) / 10 : 0;

      // Top-5 meest voorkomende shifts (drempelwaarde: minstens 3 keer gezien)
      const shifts: TypischeShift[] = Array.from(v.slots.entries())
        .filter(([, freq]) => freq >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([slot, freq]) => {
          const [start, eind] = slot.split("-");
          return { start, eind, uren: parseUren(start, eind), freq };
        })
        .sort((a, b) => a.start.localeCompare(b.start)); // sorteer op starttijd

      return { weekdag: wd, label: DAG_LABELS[wd], gemMensen, shifts };
    })
    .sort((a, b) => a.weekdag - b.weekdag);
}

// Diensten de komende 14 dagen
export function komendeDiensten(dagVooruitMax = 14): { datum: string; label: string; mensen: string[]; aantalMensen: number }[] {
  const diensten = parseDiensten();
  const vandaag = new Date();
  const grens = new Date(vandaag);
  grens.setDate(grens.getDate() + dagVooruitMax);

  const vandaagStr = vandaag.toISOString().slice(0, 10);
  const grensStr   = grens.toISOString().slice(0, 10);

  const perDag = new Map<string, { namen: Set<string>; dag: string }>();
  for (const d of diensten) {
    if (d.datum < vandaagStr || d.datum > grensStr) continue;
    const entry = perDag.get(d.datum) ?? { namen: new Set(), dag: DAG_LABELS[d.weekdag] };
    entry.namen.add(d.naam);
    perDag.set(d.datum, entry);
  }

  return Array.from(perDag.entries())
    .map(([datum, v]) => ({
      datum,
      label: `${v.dag} ${datum.slice(8)}-${datum.slice(5, 7)}`,
      mensen: Array.from(v.namen).filter((n) => n !== "Anonymous User"),
      aantalMensen: v.namen.size,
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}
