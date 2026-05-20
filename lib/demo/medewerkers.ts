/**
 * Fictieve medewerkers en rooster data voor de demo.
 */

import type { Bedrijf } from "@/lib/sumup";
import type { Dienst, DagBezetting } from "@/lib/rooster";
import { addDays, format, startOfWeek } from "date-fns";

export interface DemoMedewerker {
  id: number;
  voornaam: string;
  achternaam: string;
  email: string;
  uurloon: number;
  bedrijven: Bedrijf[];
  startdatum: string;
  actief: boolean;
}

export const DEMO_MEDEWERKERS: DemoMedewerker[] = [
  { id: 1,  voornaam: "Lars",      achternaam: "van den Berg",   email: "lars@demo.nl",     uurloon: 14.50, bedrijven: ["bb"],        startdatum: "2022-03-01", actief: true },
  { id: 2,  voornaam: "Emma",      achternaam: "Jansen",         email: "emma@demo.nl",     uurloon: 13.50, bedrijven: ["bb"],        startdatum: "2022-06-01", actief: true },
  { id: 3,  voornaam: "Noah",      achternaam: "de Vries",       email: "noah@demo.nl",     uurloon: 13.00, bedrijven: ["bb", "sl"],  startdatum: "2023-01-15", actief: true },
  { id: 4,  voornaam: "Sophie",    achternaam: "Bakker",         email: "sophie@demo.nl",   uurloon: 14.00, bedrijven: ["bb"],        startdatum: "2022-09-01", actief: true },
  { id: 5,  voornaam: "Daan",      achternaam: "Smit",           email: "daan@demo.nl",     uurloon: 12.50, bedrijven: ["bb"],        startdatum: "2023-04-01", actief: true },
  { id: 6,  voornaam: "Julia",     achternaam: "Visser",         email: "julia@demo.nl",    uurloon: 15.00, bedrijven: ["sl"],        startdatum: "2022-02-01", actief: true },
  { id: 7,  voornaam: "Finn",      achternaam: "Mulder",         email: "finn@demo.nl",     uurloon: 14.00, bedrijven: ["sl"],        startdatum: "2022-07-01", actief: true },
  { id: 8,  voornaam: "Lena",      achternaam: "de Boer",        email: "lena@demo.nl",     uurloon: 13.50, bedrijven: ["sl"],        startdatum: "2023-02-01", actief: true },
  { id: 9,  voornaam: "Tim",       achternaam: "Meijer",         email: "tim@demo.nl",      uurloon: 13.00, bedrijven: ["sl"],        startdatum: "2023-05-01", actief: true },
  { id: 10, voornaam: "Noor",      achternaam: "Bos",            email: "noor@demo.nl",     uurloon: 14.50, bedrijven: ["kl"],        startdatum: "2022-04-01", actief: true },
  { id: 11, voornaam: "Sander",    achternaam: "van Leeuwen",    email: "sander@demo.nl",   uurloon: 13.50, bedrijven: ["kl"],        startdatum: "2022-10-01", actief: true },
  { id: 12, voornaam: "Fleur",     achternaam: "Dijkstra",       email: "fleur@demo.nl",    uurloon: 13.00, bedrijven: ["kl"],        startdatum: "2023-03-01", actief: true },
  { id: 13, voornaam: "Bas",       achternaam: "Peters",         email: "bas@demo.nl",      uurloon: 16.00, bedrijven: ["bb", "kl"],  startdatum: "2021-11-01", actief: true },
  { id: 14, voornaam: "Anouk",     achternaam: "Hendriks",       email: "anouk@demo.nl",    uurloon: 12.50, bedrijven: ["bb"],        startdatum: "2024-01-15", actief: true },
  { id: 15, voornaam: "Luuk",      achternaam: "van Dam",        email: "luuk@demo.nl",     uurloon: 12.50, bedrijven: ["sl", "kl"],  startdatum: "2024-02-01", actief: true },
];

// Shift types
const SHIFTS = {
  ochtend: { start: "09:00", eind: "16:00", label: "Ochtend" },
  middag:  { start: "12:00", eind: "18:00", label: "Middag"  },
  avond:   { start: "17:00", eind: "23:00", label: "Avond"   },
  keuken:  { start: "10:00", eind: "17:00", label: "Keuken"  },
  lang:    { start: "09:30", eind: "17:30", label: "Lang"    },
};

let dienstIdTeller = 1000;

function maakDienst(
  medewerkerId: number,
  voornaam: string,
  achternaam: string,
  datum: Date,
  shift: typeof SHIFTS[keyof typeof SHIFTS],
  bedrijf: Bedrijf,
): Dienst {
  const [startH, startM] = shift.start.split(":").map(Number);
  const [eindH, eindM]   = shift.eind.split(":").map(Number);
  const uren = (eindH * 60 + eindM - startH * 60 - startM) / 60;

  return {
    id: String(dienstIdTeller++),
    datum: format(datum, "yyyy-MM-dd"),
    weekdag: datum.getDay(),
    start: shift.start,
    eind: shift.eind,
    uren,
    bedrijf,
    medewerker: {
      id: String(medewerkerId),
      naam: `${voornaam} ${achternaam}`,
      voornaam,
    },
    shiftType: shift.label,
    gepubliceerd: true,
  };
}

// Vaste roosters per bedrijf per weekdag (0=zo, 1=ma, ... 6=za)
const BB_ROOSTER: Array<{ weekdag: number; medewerkerIds: number[]; shift: keyof typeof SHIFTS }> = [
  { weekdag: 1, medewerkerIds: [1, 2],    shift: "ochtend" },
  { weekdag: 1, medewerkerIds: [5],        shift: "avond"   },
  { weekdag: 2, medewerkerIds: [2, 4],    shift: "ochtend" },
  { weekdag: 2, medewerkerIds: [1, 5],    shift: "avond"   },
  { weekdag: 3, medewerkerIds: [1, 2, 4], shift: "middag"  },
  { weekdag: 3, medewerkerIds: [3, 5],    shift: "avond"   },
  { weekdag: 4, medewerkerIds: [2, 4, 14],shift: "middag"  },
  { weekdag: 4, medewerkerIds: [1, 3, 5], shift: "avond"   },
  { weekdag: 5, medewerkerIds: [1, 2, 4, 13], shift: "middag" },
  { weekdag: 5, medewerkerIds: [3, 5, 14], shift: "avond"  },
  { weekdag: 6, medewerkerIds: [2, 4, 13, 14], shift: "lang" },
  { weekdag: 6, medewerkerIds: [1, 3, 5],  shift: "avond"  },
  { weekdag: 0, medewerkerIds: [1, 2, 4, 14], shift: "lang" },
  { weekdag: 0, medewerkerIds: [3, 5],    shift: "avond"   },
];

const SL_ROOSTER: Array<{ weekdag: number; medewerkerIds: number[]; shift: keyof typeof SHIFTS }> = [
  { weekdag: 2, medewerkerIds: [6, 7],    shift: "middag"  },
  { weekdag: 2, medewerkerIds: [8],        shift: "avond"   },
  { weekdag: 3, medewerkerIds: [6, 8],    shift: "keuken"  },
  { weekdag: 3, medewerkerIds: [7, 9],    shift: "avond"   },
  { weekdag: 4, medewerkerIds: [6, 7, 8], shift: "middag"  },
  { weekdag: 4, medewerkerIds: [3, 9, 15],shift: "avond"   },
  { weekdag: 5, medewerkerIds: [6, 7, 8, 3], shift: "keuken" },
  { weekdag: 5, medewerkerIds: [9, 15],   shift: "avond"   },
  { weekdag: 6, medewerkerIds: [6, 7, 8, 9, 3], shift: "lang" },
  { weekdag: 6, medewerkerIds: [15],      shift: "avond"   },
  { weekdag: 0, medewerkerIds: [6, 8, 9], shift: "lang"    },
  { weekdag: 0, medewerkerIds: [7, 15],   shift: "avond"   },
];

const KL_ROOSTER: Array<{ weekdag: number; medewerkerIds: number[]; shift: keyof typeof SHIFTS }> = [
  { weekdag: 1, medewerkerIds: [10],       shift: "middag"  },
  { weekdag: 1, medewerkerIds: [11, 13],  shift: "avond"   },
  { weekdag: 3, medewerkerIds: [10, 11],  shift: "middag"  },
  { weekdag: 3, medewerkerIds: [12, 13],  shift: "avond"   },
  { weekdag: 4, medewerkerIds: [10, 11],  shift: "middag"  },
  { weekdag: 4, medewerkerIds: [12, 13, 15], shift: "avond" },
  { weekdag: 5, medewerkerIds: [10, 11, 12], shift: "lang"  },
  { weekdag: 5, medewerkerIds: [13, 15],  shift: "avond"   },
  { weekdag: 6, medewerkerIds: [10, 11, 12, 13], shift: "lang" },
  { weekdag: 6, medewerkerIds: [15],      shift: "avond"   },
  { weekdag: 0, medewerkerIds: [10, 12],  shift: "lang"    },
  { weekdag: 0, medewerkerIds: [11, 15],  shift: "avond"   },
];

const ROOSTER_PER_BEDRIJF: Record<Bedrijf, typeof BB_ROOSTER> = {
  bb: BB_ROOSTER,
  sl: SL_ROOSTER,
  kl: KL_ROOSTER,
};

export function getDemoDiensten(bedrijf: Bedrijf, datum: Date): Dienst[] {
  const weekdag = datum.getDay();
  const rooster = ROOSTER_PER_BEDRIJF[bedrijf];
  const diensten: Dienst[] = [];

  for (const regel of rooster) {
    if (regel.weekdag !== weekdag) continue;
    for (const medId of regel.medewerkerIds) {
      const med = DEMO_MEDEWERKERS.find((m) => m.id === medId);
      if (!med) continue;
      diensten.push(maakDienst(medId, med.voornaam, med.achternaam, datum, SHIFTS[regel.shift], bedrijf));
    }
  }

  return diensten;
}

export function getDemoBezettingWeek(bedrijf: Bedrijf, dagCount: number): DagBezetting[] {
  const result: DagBezetting[] = [];
  const vandaag = new Date();

  for (let i = 0; i < dagCount; i++) {
    const dag = addDays(vandaag, i);
    const diensten = getDemoDiensten(bedrijf, dag);
    const uniekeMensen = new Set(diensten.map((d) => d.medewerker.id)).size;
    const totaalUren = diensten.reduce((s, d) => s + d.uren, 0);
    const weekdagNamen = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

    result.push({
      datum: format(dag, "yyyy-MM-dd"),
      weekdag: dag.getDay(),
      label: weekdagNamen[dag.getDay()],
      aantalMensen: uniekeMensen,
      totaalUren,
      diensten,
    });
  }

  return result;
}
