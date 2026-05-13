/**
 * Auto-rooster generator.
 *
 * Bouwt een concept-rooster voor een week op basis van:
 * - Verwachte drukte (uit dashboardAggregaten prognose)
 * - Beschikbaarheid van medewerkers
 * - Shift-templates per drukte-niveau
 * - Eerlijke verdeling van uren over medewerkers
 * - Cruise-passagiers en feestdagen als override (extra mensen)
 *
 * Gebruikt v1: pure heuristiek, geen AI. v2 zal Claude inzetten voor edge cases.
 */

import type { Bedrijf } from "./sumup";
import type { Medewerker, Beschikbaarheid, NieuweDienst } from "./rooster";
import { fetchBeschikbaarheid, fetchDienstenInRange, medewerkersPerBedrijf, createRoster } from "./rooster";
import { dashboardAggregaten } from "./dashboard-cache";
import { cruisesOpDatum } from "./cruises";
import { feestdagOpDatum } from "./feestdagen";

interface ShiftSlot {
  start: string;
  eind: string;
  rol: "opener" | "middag" | "sluiter";
}

interface DrukteTemplate {
  label: string;
  shifts: ShiftSlot[];
}

// Shift-templates per vestiging en drukte-niveau. Bron: BezettingAdvies component
// — daarop is dit afgestemd zodat advies en auto-rooster overeenkomen.
const TEMPLATES: Record<Bedrijf, Record<"normaal" | "druk" | "extreem", DrukteTemplate>> = {
  bb: {
    normaal: {
      label: "Normaal",
      shifts: [
        { start: "09:30", eind: "15:00", rol: "opener" },
        { start: "09:30", eind: "16:00", rol: "opener" },
      ],
    },
    druk: {
      label: "Druk",
      shifts: [
        { start: "09:30", eind: "15:00", rol: "opener" },
        { start: "09:30", eind: "15:00", rol: "opener" },
        { start: "13:00", eind: "20:00", rol: "middag" },
        { start: "16:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    extreem: {
      label: "Extreem druk",
      shifts: [
        { start: "09:30", eind: "18:00", rol: "opener" },
        { start: "09:30", eind: "18:00", rol: "opener" },
        { start: "12:00", eind: "18:00", rol: "middag" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
  },
  sl: {
    normaal: {
      label: "Normaal",
      shifts: [{ start: "10:00", eind: "20:00", rol: "opener" }],
    },
    druk: {
      label: "Druk",
      shifts: [
        { start: "10:00", eind: "16:00", rol: "opener" },
        { start: "12:00", eind: "20:00", rol: "middag" },
        { start: "16:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    extreem: {
      label: "Extreem druk",
      shifts: [
        { start: "10:00", eind: "20:00", rol: "opener" },
        { start: "10:00", eind: "16:00", rol: "opener" },
        { start: "12:00", eind: "20:00", rol: "middag" },
        { start: "16:00", eind: "20:00", rol: "sluiter" },
      ],
    },
  },
  kl: {
    normaal: {
      label: "Normaal",
      shifts: [
        { start: "10:00", eind: "15:00", rol: "opener" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    druk: {
      label: "Druk",
      shifts: [
        { start: "10:00", eind: "15:00", rol: "opener" },
        { start: "12:00", eind: "18:00", rol: "middag" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    extreem: {
      label: "Extreem druk",
      shifts: [
        { start: "10:00", eind: "15:00", rol: "opener" },
        { start: "10:00", eind: "16:00", rol: "opener" },
        { start: "12:00", eind: "18:00", rol: "middag" },
        { start: "12:00", eind: "20:00", rol: "middag" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
  },
};

const ZONDAG_TEMPLATES: Record<Bedrijf, DrukteTemplate> = {
  bb: {
    label: "Zondag",
    shifts: [
      { start: "09:30", eind: "16:00", rol: "opener" },
      { start: "13:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  sl: {
    label: "Zondag",
    shifts: [
      { start: "10:00", eind: "16:00", rol: "opener" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  kl: {
    label: "Zondag",
    shifts: [
      { start: "10:00", eind: "15:00", rol: "opener" },
      { start: "15:00", eind: "20:00", rol: "sluiter" },
    ],
  },
};

const MARATHON_TEMPLATES: Record<Bedrijf, DrukteTemplate> = {
  bb: {
    label: "Marathon Rotterdam",
    shifts: [
      { start: "09:30", eind: "20:00", rol: "opener" },
      { start: "09:30", eind: "20:00", rol: "opener" },
      { start: "12:00", eind: "20:00", rol: "middag" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  sl: {
    label: "Marathon Rotterdam",
    shifts: [
      { start: "10:00", eind: "20:00", rol: "opener" },
      { start: "10:00", eind: "20:00", rol: "opener" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  kl: {
    label: "Marathon Rotterdam",
    shifts: [
      { start: "10:00", eind: "15:00", rol: "opener" },
      { start: "12:00", eind: "18:00", rol: "middag" },
      { start: "15:00", eind: "20:00", rol: "sluiter" },
    ],
  },
};

// Max uren per medewerker per week (configurabel later via DB-veld)
const MAX_UREN_PER_WEEK = 40;

// Doel loonkost-percentage. Horeca-vuistregel: ≤25% is gezond, >30% verliesrisico.
// Als een template > BUDGET_TARGET van de verwachte dagomzet kost, schakelen we
// automatisch een tandje lager (extreem → druk → normaal).
const BUDGET_TARGET_PCT = 0.30;

// Fallback uurloon als medewerker geen uurloon heeft ingevuld (eerlijke schatting)
const FALLBACK_UURLOON = 16;

function hhmmNaarMinuten(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function shiftUren(shift: ShiftSlot): number {
  return (hhmmNaarMinuten(shift.eind) - hhmmNaarMinuten(shift.start)) / 60;
}

function plusDagen(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(dt);
}

function weekdag(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Past shift-tijden aan binnen de beperkte beschikbaarheid van een medewerker.
 * Returnt null als er geen overlap is.
 */
function passinBeperkt(shift: ShiftSlot, beschStart: string, beschEind: string): ShiftSlot | null {
  const sStart = hhmmNaarMinuten(shift.start);
  const sEind  = hhmmNaarMinuten(shift.eind);
  const bStart = hhmmNaarMinuten(beschStart);
  const bEind  = hhmmNaarMinuten(beschEind);

  const overlapStart = Math.max(sStart, bStart);
  const overlapEind  = Math.min(sEind, bEind);
  // Te kleine overlap (< 3u) is niet zinvol als shift
  if (overlapEind - overlapStart < 3 * 60) return null;

  return {
    rol: shift.rol,
    start: `${String(Math.floor(overlapStart / 60)).padStart(2, "0")}:${String(overlapStart % 60).padStart(2, "0")}`,
    eind:  `${String(Math.floor(overlapEind / 60)).padStart(2, "0")}:${String(overlapEind % 60).padStart(2, "0")}`,
  };
}

interface KandidaatScore {
  medewerker: Medewerker;
  urenDezeWeek: number;        // al ingepland deze week
  aangepasteShift: ShiftSlot;  // mogelijk aangepast voor 'beperkt'
  beschikbaarheid: "vrij" | "beperkt";
}

interface DagSamenvatting {
  datum: string;
  template: string;
  verwachteOmzet: number;
  loonkosten: number;
  loonkostPct: number;        // 0..1 (loonkost als deel van omzet)
  marge: number;              // omzet - loonkosten
  ingeplandeUren: number;
  budgetOverschreden: boolean;
}

interface AutoRoosterResultaat {
  weekStart: string;
  weekEind: string;
  bedrijf: Bedrijf;
  ingepland: Array<{
    datum: string;
    medewerker: string;       // voornaam achternaam
    medewerkerId: string;
    start: string;
    eind: string;
    rol: string;
    template: string;
    uurloon: number;
    shiftKosten: number;
    aangepastVoorBeschikbaarheid: boolean;
  }>;
  overgeslagen: Array<{
    datum: string;
    rol: string;
    start: string;
    eind: string;
    reden: string;
  }>;
  samenvatting: {
    aantalIngepland: number;
    aantalOvergeslagen: number;
    totaalUren: number;
    totaalLoonkosten: number;
    totaalVerwachteOmzet: number;
    loonkostPctWeek: number;
    perMedewerker: Array<{ medewerker: string; uren: number; aantal: number; loonkosten: number }>;
    perDag: DagSamenvatting[];
  };
}

/**
 * Hoofdroutine: genereer concept-rooster voor een week.
 * - Slaat dagen over waarop al gepubliceerde diensten staan (geen overschrijven).
 * - Schrijft nieuwe diensten als concept (gepubliceerd=false).
 */
export async function genereerAutoRooster(
  bedrijf: Bedrijf,
  weekStart: string,            // YYYY-MM-DD (maandag)
): Promise<AutoRoosterResultaat> {
  const weekEind = plusDagen(weekStart, 6);

  // Data ophalen
  const [medewerkers, beschikbaarheid, bestaandeDiensten, agg] = await Promise.all([
    medewerkersPerBedrijf(bedrijf),
    fetchBeschikbaarheid(weekStart, weekEind),
    fetchDienstenInRange(weekStart, weekEind),
    dashboardAggregaten(bedrijf),
  ]);

  // Filter alleen diensten voor dit bedrijf
  const dienstenDitBedrijf = bestaandeDiensten.filter((d) => d.bedrijf === bedrijf);

  // Bouw lookups
  const beschMap = new Map<string, Beschikbaarheid>();
  for (const b of beschikbaarheid) {
    beschMap.set(`${b.userId}|${b.datum}`, b);
  }
  const prognoseMap = new Map<string, { verwacht: number; druk: string }>();
  for (const p of agg.prognose) {
    prognoseMap.set(p.datum, { verwacht: p.verwacht, druk: p.druk });
  }

  // Per medewerker: uren al ingepland deze week + dagen met dienst
  const urenPerMedewerker = new Map<string, number>();
  const dagenMetDienst = new Map<string, Set<string>>(); // userId → set datums
  for (const d of dienstenDitBedrijf) {
    urenPerMedewerker.set(d.medewerker.id, (urenPerMedewerker.get(d.medewerker.id) ?? 0) + d.uren);
    if (!dagenMetDienst.has(d.medewerker.id)) dagenMetDienst.set(d.medewerker.id, new Set());
    dagenMetDienst.get(d.medewerker.id)!.add(d.datum);
  }

  // Welke dagen hebben al gepubliceerde diensten? Die slaan we over.
  const gepubliceerdOpDag = new Set<string>();
  for (const d of dienstenDitBedrijf) {
    if (d.gepubliceerd) gepubliceerdOpDag.add(d.datum);
  }

  const ingepland: AutoRoosterResultaat["ingepland"] = [];
  const overgeslagen: AutoRoosterResultaat["overgeslagen"] = [];
  const dagSamenvattingen: DagSamenvatting[] = [];

  // Helper: schat template-kosten op basis van gemiddeld uurloon van beschikbare medewerkers
  const gemiddeldUurloon =
    medewerkers.length > 0
      ? medewerkers.reduce((s, m) => s + (m.uurloon ?? FALLBACK_UURLOON), 0) / medewerkers.length
      : FALLBACK_UURLOON;

  function schatTemplateKosten(tpl: DrukteTemplate): number {
    return tpl.shifts.reduce((sum, s) => sum + shiftUren(s) * gemiddeldUurloon, 0);
  }

  // Loop door de 7 dagen
  for (let i = 0; i < 7; i++) {
    const datum = plusDagen(weekStart, i);
    const wd = weekdag(datum);

    // Skip dagen met gepubliceerde diensten (manager heeft die al goedgekeurd)
    if (gepubliceerdOpDag.has(datum)) {
      continue;
    }

    // Bepaal template
    const [y, m, dd] = datum.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, dd));
    const feest = feestdagOpDatum(dt);
    const cruises = cruisesOpDatum(datum);
    const totaalPax = cruises.reduce((s, c) => s + c.passagiers, 0);

    // Marathon override
    const isMarathon = feest?.naam.includes("Marathon") ?? false;
    // Feestdag met impact="dicht" — skip die dag (gesloten)
    if (feest?.impact === "dicht") {
      continue;
    }

    const prog = prognoseMap.get(datum);
    const verwachteOmzet = prog?.verwacht ?? 0;

    let template: DrukteTemplate;
    let budgetOverschreden = false;
    if (isMarathon) {
      template = MARATHON_TEMPLATES[bedrijf];
    } else if (wd === 0) {
      template = ZONDAG_TEMPLATES[bedrijf];
    } else {
      // Drukte uit prognose
      let drukteNiveau: "normaal" | "druk" | "extreem" = "normaal";
      if (prog) {
        if (prog.druk === "zeer druk" || prog.druk === "druk") {
          drukteNiveau = prog.druk === "zeer druk" ? "extreem" : "druk";
        }
      }
      // Cruise-override: > 3000 pax → minstens druk; > 5000 pax → extreem
      if (totaalPax >= 5000) drukteNiveau = "extreem";
      else if (totaalPax >= 3000 && drukteNiveau === "normaal") drukteNiveau = "druk";
      // Zaterdag altijd minimaal druk
      if (wd === 6 && drukteNiveau === "normaal") drukteNiveau = "druk";

      template = TEMPLATES[bedrijf][drukteNiveau];

      // Budget-check: als template-kosten > BUDGET_TARGET van verwachte omzet,
      // schakel een tandje lager. Alleen toepassen als er een prognose is met
      // verwachte omzet > 0 (geen prognose = geen budget-vergelijking).
      if (verwachteOmzet > 0) {
        const budget = verwachteOmzet * BUDGET_TARGET_PCT;
        let kosten = schatTemplateKosten(template);

        if (kosten > budget) {
          if (drukteNiveau === "extreem") {
            template = TEMPLATES[bedrijf].druk;
            drukteNiveau = "druk";
            kosten = schatTemplateKosten(template);
          }
          if (kosten > budget && drukteNiveau === "druk") {
            template = TEMPLATES[bedrijf].normaal;
            kosten = schatTemplateKosten(template);
          }
          // Als zelfs normaal-template > budget, accepteren we de overschrijding
          // (kleine bedrijven zoals SL hebben weinig speelruimte)
          budgetOverschreden = kosten > budget;
        }
      }
    }

    // Welke shifts staan er al voor deze dag? (concepten van vorige run niet overschrijven)
    const reedsIngepland = dienstenDitBedrijf.filter((d) => d.datum === datum);

    // Per shift in het template: vind beste kandidaat
    for (const shift of template.shifts) {
      // Skip als deze shift al ongeveer ingepland staat (zelfde start+eind ±15 min)
      const alIngepland = reedsIngepland.some(
        (d) =>
          Math.abs(hhmmNaarMinuten(d.start) - hhmmNaarMinuten(shift.start)) < 15 &&
          Math.abs(hhmmNaarMinuten(d.eind) - hhmmNaarMinuten(shift.eind)) < 15,
      );
      if (alIngepland) continue;

      // Verzamel kandidaten
      const kandidaten: KandidaatScore[] = [];
      for (const m of medewerkers) {
        if (m.einddatum) continue; // niet meer actief
        // Geen dubbele dienst dezelfde dag
        if (dagenMetDienst.get(m.id)?.has(datum)) continue;

        const besch = beschMap.get(`${m.id}|${datum}`);
        const urenWeek = urenPerMedewerker.get(m.id) ?? 0;
        const sUren = shiftUren(shift);

        if (urenWeek + sUren > MAX_UREN_PER_WEEK) continue;

        if (besch?.status === "niet") continue;

        if (besch?.status === "beperkt" && besch.start && besch.eind) {
          const aangepast = passinBeperkt(shift, besch.start, besch.eind);
          if (!aangepast) continue;
          kandidaten.push({
            medewerker: m,
            urenDezeWeek: urenWeek,
            aangepasteShift: aangepast,
            beschikbaarheid: "beperkt",
          });
        } else {
          // 'vrij' of 'onbekend' (geen opgave)
          kandidaten.push({
            medewerker: m,
            urenDezeWeek: urenWeek,
            aangepasteShift: shift,
            beschikbaarheid: besch?.status === "vrij" ? "vrij" : "vrij",
          });
        }
      }

      if (kandidaten.length === 0) {
        overgeslagen.push({
          datum,
          rol: shift.rol,
          start: shift.start,
          eind: shift.eind,
          reden: "geen beschikbare medewerker",
        });
        continue;
      }

      // Sorteer: eerlijke verdeling (minste uren eerst) → lager uurloon → expliciet vrij gemeld
      kandidaten.sort((a, b) => {
        if (a.urenDezeWeek !== b.urenDezeWeek) return a.urenDezeWeek - b.urenDezeWeek;
        const ah = a.medewerker.uurloon ?? 0;
        const bh = b.medewerker.uurloon ?? 0;
        if (ah !== bh) return ah - bh;
        // Wie expliciet "vrij" heeft gemeld krijgt voorrang boven "onbekend"
        return a.beschikbaarheid === "vrij" ? -1 : 1;
      });

      const winnaar = kandidaten[0];
      const finalShift = winnaar.aangepasteShift;
      const finalUren = shiftUren(finalShift);
      const uurloon = winnaar.medewerker.uurloon ?? FALLBACK_UURLOON;
      const shiftKosten = finalUren * uurloon;

      // Schrijf naar DB als concept
      await createRoster({
        bedrijf,
        userId: winnaar.medewerker.id,
        datum,
        start: finalShift.start,
        eind: finalShift.eind,
        pauzeMin: 0,
        notitie: `Auto-rooster (${template.label})`,
        gepubliceerd: false,
      });

      // Update lokale tellers
      urenPerMedewerker.set(winnaar.medewerker.id, (urenPerMedewerker.get(winnaar.medewerker.id) ?? 0) + finalUren);
      if (!dagenMetDienst.has(winnaar.medewerker.id)) dagenMetDienst.set(winnaar.medewerker.id, new Set());
      dagenMetDienst.get(winnaar.medewerker.id)!.add(datum);

      ingepland.push({
        datum,
        medewerker: `${winnaar.medewerker.voornaam} ${winnaar.medewerker.achternaam}`,
        medewerkerId: winnaar.medewerker.id,
        start: finalShift.start,
        eind: finalShift.eind,
        rol: shift.rol,
        template: template.label,
        uurloon,
        shiftKosten,
        aangepastVoorBeschikbaarheid: winnaar.beschikbaarheid === "beperkt",
      });
    }

    // Dag-samenvatting samenstellen (loonkost-% op basis van verwachte omzet)
    const dagShifts = ingepland.filter((r) => r.datum === datum);
    const dagUren = dagShifts.reduce(
      (s, r) => s + (hhmmNaarMinuten(r.eind) - hhmmNaarMinuten(r.start)) / 60,
      0,
    );
    const dagLoonkost = dagShifts.reduce((s, r) => s + r.shiftKosten, 0);
    dagSamenvattingen.push({
      datum,
      template: template.label,
      verwachteOmzet,
      loonkosten: Math.round(dagLoonkost * 100) / 100,
      loonkostPct: verwachteOmzet > 0 ? dagLoonkost / verwachteOmzet : 0,
      marge: Math.round((verwachteOmzet - dagLoonkost) * 100) / 100,
      ingeplandeUren: dagUren,
      budgetOverschreden,
    });
  }

  // Samenvatting
  const perMedewerkerMap = new Map<string, { uren: number; aantal: number; loonkosten: number }>();
  for (const r of ingepland) {
    const u = (hhmmNaarMinuten(r.eind) - hhmmNaarMinuten(r.start)) / 60;
    const cur = perMedewerkerMap.get(r.medewerker) ?? { uren: 0, aantal: 0, loonkosten: 0 };
    perMedewerkerMap.set(r.medewerker, {
      uren: cur.uren + u,
      aantal: cur.aantal + 1,
      loonkosten: cur.loonkosten + r.shiftKosten,
    });
  }
  const perMedewerker = Array.from(perMedewerkerMap.entries())
    .map(([medewerker, v]) => ({
      medewerker,
      uren: Math.round(v.uren * 10) / 10,
      aantal: v.aantal,
      loonkosten: Math.round(v.loonkosten * 100) / 100,
    }))
    .sort((a, b) => b.uren - a.uren);

  const totaalUren = perMedewerker.reduce((s, p) => s + p.uren, 0);
  const totaalLoonkosten = perMedewerker.reduce((s, p) => s + p.loonkosten, 0);
  const totaalVerwachteOmzet = dagSamenvattingen.reduce((s, d) => s + d.verwachteOmzet, 0);

  return {
    weekStart,
    weekEind,
    bedrijf,
    ingepland,
    overgeslagen,
    samenvatting: {
      aantalIngepland: ingepland.length,
      aantalOvergeslagen: overgeslagen.length,
      totaalUren: Math.round(totaalUren * 10) / 10,
      totaalLoonkosten: Math.round(totaalLoonkosten * 100) / 100,
      totaalVerwachteOmzet: Math.round(totaalVerwachteOmzet * 100) / 100,
      loonkostPctWeek: totaalVerwachteOmzet > 0 ? totaalLoonkosten / totaalVerwachteOmzet : 0,
      perMedewerker,
      perDag: dagSamenvattingen,
    },
  };
}
