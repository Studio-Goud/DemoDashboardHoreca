/**
 * Salaris-administratie.
 *
 * Bron-data:
 * - `klok_events` (werkelijk in/uit-geklokt) — primair voor recente maanden.
 * - `rosters` (gepland en gepubliceerd) — fallback voor oudere maanden waar
 *   geen klok-data is (bv. data gemigreerd uit Shiftbase).
 *
 * Berekening per medewerker per maand:
 *   bruto_loon       = brutoUren × uurloon
 *   vakantiegeld_eur = bruto_loon × vakantiegeld_pct%   (default 8.33%)
 *   vakantie_uren_eur= bruto_loon × vakantie_uren_pct%  (default 8.00%)
 *   totaal_eur       = bruto_loon + vakantiegeld + vakantie_uren
 *
 * Hash-check: SHA-256 over alle numerieke velden + (jaar, maand, medewerkerId).
 * Wanneer een afgerekende periode een afwijkend hash krijgt → integriteit
 * is geschonden, manager moet onderzoek doen.
 */

import { createHash } from "node:crypto";
import { eq, and, gte, lte, asc, isNull } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { Bedrijf } from "./sumup";

export type SalarisBron = "klok" | "rooster" | "mix";
export type SalarisStatus = "open" | "afgerekend" | "uitbetaald";

export interface SalarisBerekening {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  jaar: number;
  maand: number;
  brutoUren: number;
  uurloon: number;
  brutoLoon: number;
  vakantiegeldPct: number;
  vakantiegeldEur: number;
  vakantieUrenPct: number;
  vakantieUrenEur: number;
  totaalEur: number;
  bron: SalarisBron;
  berekenHash: string;
  details: Array<{ datum: string; uren: number; bron: "klok" | "rooster"; pauzeMin: number; departmentSlug: string | null }>;
  /** Uren gesplitst per vestiging waar gewerkt — laat zien wanneer een
   *  medewerker thuis bij BB hoort maar uren maakte op SL (inleen). */
  urenPerVestiging: Array<{ departmentSlug: string; departmentNaam: string; uren: number }>;
}

const DEFAULT_VAKANTIEGELD_PCT = 8.333;
const DEFAULT_VAKANTIE_UREN_PCT = 8.0;

function maandRange(jaar: number, maand: number): { start: string; eind: string } {
  const start = new Date(Date.UTC(jaar, maand - 1, 1));
  const eind  = new Date(Date.UTC(jaar, maand, 0));
  const fmt = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(d);
  return { start: fmt(start), eind: fmt(eind) };
}

function rondAfTwee(n: number): number {
  return Math.round(n * 100) / 100;
}

function berekenHash(b: Omit<SalarisBerekening, "berekenHash" | "details" | "voornaam" | "achternaam">): string {
  const data = JSON.stringify({
    medewerkerId: b.medewerkerId,
    jaar: b.jaar,
    maand: b.maand,
    brutoUren: rondAfTwee(b.brutoUren),
    uurloon: rondAfTwee(b.uurloon),
    brutoLoon: rondAfTwee(b.brutoLoon),
    vakantiegeldPct: b.vakantiegeldPct,
    vakantiegeldEur: rondAfTwee(b.vakantiegeldEur),
    vakantieUrenPct: b.vakantieUrenPct,
    vakantieUrenEur: rondAfTwee(b.vakantieUrenEur),
    totaalEur: rondAfTwee(b.totaalEur),
    bron: b.bron,
  });
  return createHash("sha256").update(data).digest("hex");
}

async function urenPerDagVoorMedewerker(
  medewerkerId: number,
  start: string,
  eind: string,
): Promise<Array<{ datum: string; uren: number; bron: "klok" | "rooster"; pauzeMin: number; departmentSlug: string | null }>> {
  // Klok-events met join op roster → department (om te weten waar gewerkt)
  const klokEvents = await db
    .select({
      id: schema.klokEvents.id,
      type: schema.klokEvents.type,
      tijdstempel: schema.klokEvents.tijdstempel,
      rosterId: schema.klokEvents.rosterId,
      departmentSlug: schema.departments.slug,
    })
    .from(schema.klokEvents)
    .leftJoin(schema.rosters, eq(schema.klokEvents.rosterId, schema.rosters.id))
    .leftJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    // Bound-window: events buckets'en we per NL-datum van de IN-event. Een
    // shift die om 23:30 NL-tijd op de laatste van de maand begint en om
    // 02:30 NL-tijd op de 1e van de volgende maand eindigt, valt qua OUT-
    // event buiten een naïeve `tijdstempel <= eind T23:59:59Z` range
    // (CEST = UTC+2 → OUT staat op 00:30 UTC volgende dag). We breiden de
    // query daarom met 1 dag buffer aan beide kanten en filteren daarna in
    // JS op de NL-datum van de IN-event.
    .where(and(
      eq(schema.klokEvents.medewerkerId, medewerkerId),
      gte(schema.klokEvents.tijdstempel, new Date(`${start}T00:00:00Z`)),
      // 1 dag extra zodat OUT-events laat-in-de-nacht meekomen
      lte(schema.klokEvents.tijdstempel, new Date(new Date(`${eind}T23:59:59Z`).getTime() + 26 * 60 * 60 * 1000)),
    ))
    .orderBy(asc(schema.klokEvents.tijdstempel));

  type DagAggregaat = { uren: number; bron: "klok" | "rooster"; pauzeMin: number; departmentSlug: string | null };
  // Sleutel = datum (Klok kan over middernacht lopen — slag rond door
  // de in-event datum te nemen). Voor splitsing per vestiging: als één dag
  // meerdere shifts op verschillende vestigingen kent, behouden we per
  // (datum, vestiging) een rij.
  const perDagVestiging = new Map<string, DagAggregaat>();
  let openIn: { tijd: Date; deptSlug: string | null } | null = null;
  for (const ev of klokEvents) {
    if (ev.type === "in") {
      openIn = { tijd: ev.tijdstempel, deptSlug: ev.departmentSlug };
    } else if (ev.type === "out" && openIn) {
      const uren = (ev.tijdstempel.getTime() - openIn.tijd.getTime()) / 1000 / 3600;
      const datum = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(openIn.tijd);
      // Filter: alleen shifts waarvan de IN-event NL-datum binnen [start, eind]
      // valt. Anders krijgen we shifts mee uit de buffer-dag (de 1e van de
      // volgende maand) die bij die maand horen, niet bij deze.
      if (datum >= start && datum <= eind) {
        const slug = openIn.deptSlug;
        const sleutel = `${datum}|${slug ?? ""}`;
        const cur = perDagVestiging.get(sleutel) ?? { uren: 0, bron: "klok" as const, pauzeMin: 0, departmentSlug: slug };
        cur.uren += Math.max(0, uren);
        perDagVestiging.set(sleutel, cur);
      }
      openIn = null;
    }
  }

  // Fallback op rosters voor dagen/vestigingen ZONDER klok-events
  const rosters = await db
    .select({
      datum: schema.rosters.datum,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      pauzeMin: schema.rosters.pauzeMin,
      departmentSlug: schema.departments.slug,
    })
    .from(schema.rosters)
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .where(and(
      eq(schema.rosters.medewerkerId, medewerkerId),
      eq(schema.rosters.gepubliceerd, true),
      gte(schema.rosters.datum, start),
      lte(schema.rosters.datum, eind),
    ));

  for (const r of rosters) {
    const sleutel = `${r.datum}|${r.departmentSlug}`;
    if (perDagVestiging.has(sleutel)) continue;
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.eind.split(":").map(Number);
    const minuten = Math.max(0, eh * 60 + em - sh * 60 - sm - r.pauzeMin);
    perDagVestiging.set(sleutel, {
      uren: minuten / 60,
      bron: "rooster",
      pauzeMin: r.pauzeMin,
      departmentSlug: r.departmentSlug,
    });
  }

  return Array.from(perDagVestiging.entries())
    .map(([sleutel, v]) => ({
      datum: sleutel.split("|")[0],
      uren: rondAfTwee(v.uren),
      bron: v.bron,
      pauzeMin: v.pauzeMin,
      departmentSlug: v.departmentSlug,
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

export async function berekenSalarisVoorMedewerker(
  medewerkerId: number,
  jaar: number,
  maand: number,
): Promise<SalarisBerekening | null> {
  const m = await db.select().from(schema.medewerkers).where(eq(schema.medewerkers.id, medewerkerId));
  if (!m[0]) return null;
  const med = m[0];

  const uurloon = Number(med.uurloon ?? 0);
  const vakantiegeldPct = Number(med.vakantiegeldPct ?? DEFAULT_VAKANTIEGELD_PCT);
  const vakantieUrenPct = Number(med.vakantieUrenPct ?? DEFAULT_VAKANTIE_UREN_PCT);

  const { start, eind } = maandRange(jaar, maand);
  const details = await urenPerDagVoorMedewerker(medewerkerId, start, eind);

  const brutoUren = details.reduce((s, d) => s + d.uren, 0);
  const brutoLoon = brutoUren * uurloon;
  const vakantiegeldEur = brutoLoon * (vakantiegeldPct / 100);
  const vakantieUrenEur = brutoLoon * (vakantieUrenPct / 100);
  const totaalEur = brutoLoon + vakantiegeldEur + vakantieUrenEur;

  const bronnen = new Set(details.map((d) => d.bron));
  const bron: SalarisBron =
    bronnen.size === 0 ? "rooster"
    : bronnen.size === 2 ? "mix"
    : (bronnen.has("klok") ? "klok" : "rooster");

  // Aggregeer uren per vestiging waar gewerkt — owner ziet zo direct
  // of inleen-uren erin zitten (bv. Gianni KL die 8u bij BB werkte).
  const VESTIGING_NAMEN: Record<string, string> = {
    bb: "Brunch & Brew",
    sl: "Saté Lounge",
    kl: "Het Kroket Loket",
  };
  const urenPerVestigingMap = new Map<string, number>();
  for (const d of details) {
    const slug = d.departmentSlug ?? "onbekend";
    urenPerVestigingMap.set(slug, (urenPerVestigingMap.get(slug) ?? 0) + d.uren);
  }
  const urenPerVestiging = Array.from(urenPerVestigingMap.entries())
    .map(([slug, uren]) => ({
      departmentSlug: slug,
      departmentNaam: VESTIGING_NAMEN[slug] ?? slug,
      uren: rondAfTwee(uren),
    }))
    .sort((a, b) => b.uren - a.uren);

  const berekening: Omit<SalarisBerekening, "berekenHash" | "details" | "voornaam" | "achternaam"> = {
    medewerkerId,
    jaar,
    maand,
    brutoUren: rondAfTwee(brutoUren),
    uurloon: rondAfTwee(uurloon),
    brutoLoon: rondAfTwee(brutoLoon),
    vakantiegeldPct,
    vakantiegeldEur: rondAfTwee(vakantiegeldEur),
    vakantieUrenPct,
    vakantieUrenEur: rondAfTwee(vakantieUrenEur),
    totaalEur: rondAfTwee(totaalEur),
    bron,
    urenPerVestiging,
  };

  return {
    ...berekening,
    voornaam: med.voornaam,
    achternaam: med.achternaam,
    berekenHash: berekenHash(berekening),
    details,
    urenPerVestiging,
  };
}

export async function berekenSalarisVoorBedrijf(
  bedrijf: Bedrijf,
  jaar: number,
  maand: number,
): Promise<SalarisBerekening[]> {
  const deptRow = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, bedrijf));
  if (!deptRow[0]) return [];
  const deptId = deptRow[0].id;

  // Filter op THUIS-vestiging (hoofd_department_id), NIET op de many-to-many
  // medewerker_departments tabel. Laura Chirinos kan bv. via Shiftbase-migratie
  // aan zowel BB als SL gekoppeld zijn in medewerker_departments — maar haar
  // thuis-vestiging is BB. Salaris wordt betaald door thuis-vestiging; eventueel
  // uitgeleende uren bij andere vestigingen worden via inleen-doorberekening
  // doorgefactureerd, niet via dubbele salaris-toewijzing.
  //
  // Fallback: medewerkers zonder hoofdDepartmentId (= nog niet gezet door
  // owner) vallen terug op de oude logica via medewerker_departments, zodat
  // ze niet stilletjes verdwijnen uit het salaris-overzicht.
  const primair = await db
    .select({ id: schema.medewerkers.id })
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.hoofdDepartmentId, deptId),
      eq(schema.medewerkers.actief, true),
    ));

  const fallback = await db
    .select({ id: schema.medewerkers.id })
    .from(schema.medewerkers)
    .innerJoin(schema.medewerkerDepartments, eq(schema.medewerkers.id, schema.medewerkerDepartments.medewerkerId))
    .where(and(
      eq(schema.medewerkerDepartments.departmentId, deptId),
      eq(schema.medewerkers.actief, true),
      isNull(schema.medewerkers.hoofdDepartmentId),
    ));

  const alleIds = new Set<number>();
  for (const r of primair) alleIds.add(r.id);
  for (const r of fallback) alleIds.add(r.id);

  // Parallel ipv sequentieel — was N+1 (90 DB roundtrips voor 30 medewerkers).
  // Promise.all gooit alles tegelijk in de pool en wacht op alles tegelijk;
  // de Postgres-pool serialiseert intern maar latency stapelt niet meer op.
  const berekeningen = await Promise.all(
    Array.from(alleIds).map((id) => berekenSalarisVoorMedewerker(id, jaar, maand)),
  );
  const resultaten = berekeningen.filter(
    (b): b is SalarisBerekening => b !== null && b.brutoUren > 0,
  );
  return resultaten.sort((a, b) => a.achternaam.localeCompare(b.achternaam));
}

export async function slaSalarisPeriodeOp(b: SalarisBerekening): Promise<{
  status: SalarisStatus;
  geupdate: boolean;
  hashKlopt: boolean;
}> {
  const bestaand = await db
    .select()
    .from(schema.salarisPerioden)
    .where(and(
      eq(schema.salarisPerioden.medewerkerId, b.medewerkerId),
      eq(schema.salarisPerioden.jaar, b.jaar),
      eq(schema.salarisPerioden.maand, b.maand),
    ));

  const numToStr = (n: number) => n.toFixed(2);
  const numToStrPct = (n: number) => n.toFixed(3);

  if (bestaand.length === 0) {
    await db.insert(schema.salarisPerioden).values({
      medewerkerId: b.medewerkerId,
      jaar: b.jaar,
      maand: b.maand,
      brutoUren: numToStr(b.brutoUren),
      uurloon: numToStr(b.uurloon),
      brutoLoon: numToStr(b.brutoLoon),
      vakantiegeldPct: numToStrPct(b.vakantiegeldPct),
      vakantiegeldEur: numToStr(b.vakantiegeldEur),
      vakantieUrenPct: numToStrPct(b.vakantieUrenPct),
      vakantieUrenEur: numToStr(b.vakantieUrenEur),
      totaalEur: numToStr(b.totaalEur),
      bron: b.bron,
      berekenHash: b.berekenHash,
      status: "open",
    });
    return { status: "open", geupdate: true, hashKlopt: true };
  }

  const huidig = bestaand[0];
  const status = huidig.status as SalarisStatus;
  const hashKlopt = huidig.berekenHash === b.berekenHash;

  if (status === "afgerekend" || status === "uitbetaald") {
    return { status, geupdate: false, hashKlopt };
  }

  await db.update(schema.salarisPerioden)
    .set({
      brutoUren: numToStr(b.brutoUren),
      uurloon: numToStr(b.uurloon),
      brutoLoon: numToStr(b.brutoLoon),
      vakantiegeldPct: numToStrPct(b.vakantiegeldPct),
      vakantiegeldEur: numToStr(b.vakantiegeldEur),
      vakantieUrenPct: numToStrPct(b.vakantieUrenPct),
      vakantieUrenEur: numToStr(b.vakantieUrenEur),
      totaalEur: numToStr(b.totaalEur),
      bron: b.bron,
      berekenHash: b.berekenHash,
      updatedAt: new Date(),
    })
    .where(eq(schema.salarisPerioden.id, huidig.id));

  return { status: "open", geupdate: true, hashKlopt };
}

export async function markeerAfgerekend(
  medewerkerId: number,
  jaar: number,
  maand: number,
  doorMedewerkerId: number | null,
): Promise<void> {
  await db.update(schema.salarisPerioden)
    .set({
      status: "afgerekend",
      afgerekendOp: new Date(),
      afgerekendDoor: doorMedewerkerId,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.salarisPerioden.medewerkerId, medewerkerId),
      eq(schema.salarisPerioden.jaar, jaar),
      eq(schema.salarisPerioden.maand, maand),
    ));
}

export async function markeerUitbetaald(
  medewerkerId: number,
  jaar: number,
  maand: number,
  betalingReferentie: string,
): Promise<void> {
  await db.update(schema.salarisPerioden)
    .set({
      status: "uitbetaald",
      uitbetaaldOp: new Date(),
      betalingReferentie,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.salarisPerioden.medewerkerId, medewerkerId),
      eq(schema.salarisPerioden.jaar, jaar),
      eq(schema.salarisPerioden.maand, maand),
    ));
}

export interface Maandrapport {
  bedrijf: Bedrijf;
  jaar: number;
  maand: number;
  perMedewerker: Array<SalarisBerekening & { dbStatus: SalarisStatus; hashKlopt: boolean }>;
  totaalBrutoLoon: number;
  totaalVakantiegeld: number;
  totaalVakantieUren: number;
  totaalEur: number;
  waarschuwingen: string[];
}

export async function genereerMaandrapport(
  bedrijf: Bedrijf,
  jaar: number,
  maand: number,
): Promise<Maandrapport> {
  const berekeningen = await berekenSalarisVoorBedrijf(bedrijf, jaar, maand);
  const perMedewerker: Maandrapport["perMedewerker"] = [];
  const waarschuwingen: string[] = [];

  for (const b of berekeningen) {
    const persist = await slaSalarisPeriodeOp(b);
    perMedewerker.push({ ...b, dbStatus: persist.status, hashKlopt: persist.hashKlopt });

    if (!persist.hashKlopt && (persist.status === "afgerekend" || persist.status === "uitbetaald")) {
      waarschuwingen.push(
        `⚠ ${b.voornaam} ${b.achternaam}: bron-data (rosters/klok) is gewijzigd ná het afrekenen van ${jaar}-${String(maand).padStart(2, "0")}. ` +
        `Periode blijft bevroren op oorspronkelijke bedragen; controleer wat er is aangepast in audit_log.`,
      );
    }
  }

  return {
    bedrijf,
    jaar,
    maand,
    perMedewerker,
    totaalBrutoLoon: rondAfTwee(perMedewerker.reduce((s, x) => s + x.brutoLoon, 0)),
    totaalVakantiegeld: rondAfTwee(perMedewerker.reduce((s, x) => s + x.vakantiegeldEur, 0)),
    totaalVakantieUren: rondAfTwee(perMedewerker.reduce((s, x) => s + x.vakantieUrenEur, 0)),
    totaalEur: rondAfTwee(perMedewerker.reduce((s, x) => s + x.totaalEur, 0)),
    waarschuwingen,
  };
}

export function maandrapportNaarCsv(rapport: Maandrapport): string {
  const sep = ";"; // Excel-NL standaard
  const regels: string[] = [];

  regels.push([
    "Achternaam", "Voornaam", "Maand",
    "Bruto uren", "Uurloon", "Bruto loon",
    "Vakantiegeld %", "Vakantiegeld €",
    "Vakantie-uren %", "Vakantie-uren €",
    "Totaal €", "Bron", "Status", "Hash",
  ].join(sep));

  for (const m of rapport.perMedewerker) {
    regels.push([
      m.achternaam, m.voornaam,
      `${rapport.jaar}-${String(rapport.maand).padStart(2, "0")}`,
      m.brutoUren.toFixed(2).replace(".", ","),
      m.uurloon.toFixed(2).replace(".", ","),
      m.brutoLoon.toFixed(2).replace(".", ","),
      m.vakantiegeldPct.toFixed(3).replace(".", ","),
      m.vakantiegeldEur.toFixed(2).replace(".", ","),
      m.vakantieUrenPct.toFixed(3).replace(".", ","),
      m.vakantieUrenEur.toFixed(2).replace(".", ","),
      m.totaalEur.toFixed(2).replace(".", ","),
      m.bron, m.dbStatus,
      m.berekenHash.slice(0, 16),
    ].join(sep));
  }

  regels.push("");
  regels.push([
    "TOTAAL", "",
    `${rapport.jaar}-${String(rapport.maand).padStart(2, "0")}`,
    "", "",
    rapport.totaalBrutoLoon.toFixed(2).replace(".", ","),
    "",
    rapport.totaalVakantiegeld.toFixed(2).replace(".", ","),
    "",
    rapport.totaalVakantieUren.toFixed(2).replace(".", ","),
    rapport.totaalEur.toFixed(2).replace(".", ","),
  ].join(sep));

  if (rapport.waarschuwingen.length > 0) {
    regels.push("");
    regels.push("# Waarschuwingen:");
    for (const w of rapport.waarschuwingen) regels.push(`# ${w}`);
  }

  return regels.join("\n");
}
