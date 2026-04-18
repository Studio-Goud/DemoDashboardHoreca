import cruisesData from "@/data/cruises-rotterdam.json";
import { parseISO, differenceInCalendarDays, startOfDay } from "date-fns";

export interface CruiseCall {
  datum: string;          // YYYY-MM-DD (dag van aankomst)
  ship: string;
  passagiers: number;     // max pax
  cruiseLine: string;
  arrival?: string;       // HH:mm
  departure?: string;     // HH:mm
  terminal?: string;
  notities?: string;
}

export type CruiseImpact = "minimaal" | "laag" | "middel" | "hoog";

const ALLE_CRUISES: CruiseCall[] = cruisesData as CruiseCall[];

export function impactVanPassagiers(pax: number): CruiseImpact {
  if (pax >= 3000) return "hoog";
  if (pax >= 1500) return "middel";
  if (pax >= 500) return "laag";
  return "minimaal";
}

export function impactLabel(impact: CruiseImpact): string {
  switch (impact) {
    case "hoog":     return "Hoog";
    case "middel":   return "Middel";
    case "laag":     return "Laag";
    case "minimaal": return "Minimaal";
  }
}

export function cruisesOpDatum(datum: string): CruiseCall[] {
  return ALLE_CRUISES.filter((c) => c.datum === datum).sort(
    (a, b) => (a.arrival ?? "").localeCompare(b.arrival ?? "")
  );
}

export function totaalPassagiersOpDatum(datum: string): number {
  return cruisesOpDatum(datum).reduce((s, c) => s + c.passagiers, 0);
}

// Hoogste individuele impact op een dag (voor één kleurlabel)
export function piekImpactOpDatum(datum: string): CruiseImpact | null {
  const c = cruisesOpDatum(datum);
  if (c.length === 0) return null;
  return impactVanPassagiers(Math.max(...c.map((x) => x.passagiers)));
}

export interface CruiseDag {
  datum: string;
  dagenVanNu: number;
  cruises: CruiseCall[];
  totaalPassagiers: number;
  piekImpact: CruiseImpact;
}

export function komendeCruises(maxDagen = 14): CruiseDag[] {
  const nu = startOfDay(new Date());
  const perDag = new Map<string, CruiseCall[]>();

  for (const c of ALLE_CRUISES) {
    const d = parseISO(c.datum);
    const diff = differenceInCalendarDays(d, nu);
    if (diff < 0 || diff > maxDagen) continue;
    const key = c.datum;
    if (!perDag.has(key)) perDag.set(key, []);
    perDag.get(key)!.push(c);
  }

  return Array.from(perDag.entries())
    .map(([datum, cruises]) => {
      const totaal = cruises.reduce((s, c) => s + c.passagiers, 0);
      return {
        datum,
        dagenVanNu: differenceInCalendarDays(parseISO(datum), nu),
        cruises: cruises.sort((a, b) =>
          (a.arrival ?? "").localeCompare(b.arrival ?? "")
        ),
        totaalPassagiers: totaal,
        piekImpact: impactVanPassagiers(Math.max(...cruises.map((c) => c.passagiers))),
      };
    })
    .sort((a, b) => a.datum.localeCompare(b.datum));
}
