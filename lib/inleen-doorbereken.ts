/**
 * Inleen-doorberekening tussen vestigingen.
 *
 * Wanneer een medewerker met thuis-vestiging X uren maakt bij vestiging Y,
 * is X "uitgeleend" aan Y. Aan het einde van de maand willen we voor elk
 * paar (uitlenende, inlenende) zien:
 *  - welke medewerker(s)
 *  - hoeveel uur
 *  - tegen welk uurloon
 *  - totaal te factureren bedrag
 *
 * Bron: `rosters` tabel (geplande diensten). Voor een nauwkeuriger telling
 * zou je `klok_events` kunnen gebruiken (echte gewerkte uren), maar voor
 * de doorberekening houden we het simpel met geplande uren — vakantiegeld
 * + sociale lasten blijven bij de thuis-vestiging.
 */
import { and, eq, gte, lte, isNotNull } from "drizzle-orm";
import { db, schema } from "./db/client";

export interface InleenRegel {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  uren: number;
  uurloon: number;
  bedrag: number;
}

export interface InleenPaar {
  /** Slug van de UITLENENDE vestiging (thuis van de medewerker). */
  vanSlug: string;
  /** Naam van uitlenende vestiging. */
  vanNaam: string;
  /** Slug van de INLENENDE vestiging (waar gewerkt). */
  naarSlug: string;
  /** Naam van inlenende vestiging. */
  naarNaam: string;
  /** Regels per medewerker. */
  regels: InleenRegel[];
  /** Som van uren en bedragen. */
  totaalUren: number;
  totaalBedrag: number;
}

export interface InleenMaand {
  jaar: number;
  maand: number;
  paren: InleenPaar[];
  totaalBedrag: number;
}

/**
 * Converteer "08:30" + "13:15" + pauzeMin → uren als float (decimal hours).
 */
function urenTussen(start: string, eind: string, pauzeMin: number): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = eind.split(":").map(Number);
  const minuten = (eh * 60 + em) - (sh * 60 + sm) - (pauzeMin ?? 0);
  return Math.max(0, minuten / 60);
}

export interface InleenOpties {
  /** Tel werkgeverslasten van de uitlenende vestiging mee in het bedrag. */
  metWerkgeverslasten?: boolean;
  /** Tel vakantiegeld + verlof-uren (default 16,33%) mee. */
  metVakantieOpslag?: boolean;
}

export async function berekenInleenMaand(
  jaar: number,
  maand: number,
  opties: InleenOpties = {},
): Promise<InleenMaand> {
  const startDatum = `${jaar}-${String(maand).padStart(2, "0")}-01`;
  // Laatste dag van de maand (eenvoudige berekening via volgende-maand-0)
  const eindMaand = maand === 12 ? 1 : maand + 1;
  const eindJaar = maand === 12 ? jaar + 1 : jaar;
  const eindDatum = `${eindJaar}-${String(eindMaand).padStart(2, "0")}-01`;

  // Haal alle gepubliceerde diensten van deze maand op, gejoin'd met
  // medewerker (voor hoofdDepartmentId + uurloon) en department (voor naam).
  const rijen = await db
    .select({
      rosterId: schema.rosters.id,
      datum: schema.rosters.datum,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      pauzeMin: schema.rosters.pauzeMin,
      gewerktDeptId: schema.rosters.departmentId,
      medewerkerId: schema.medewerkers.id,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
      uurloon: schema.medewerkers.uurloon,
      hoofdDepartmentId: schema.medewerkers.hoofdDepartmentId,
    })
    .from(schema.rosters)
    .innerJoin(schema.medewerkers, eq(schema.rosters.medewerkerId, schema.medewerkers.id))
    .where(and(
      gte(schema.rosters.datum, startDatum),
      lte(schema.rosters.datum, eindDatum),
      // Alleen rijen waar we beide vestigingen weten
      isNotNull(schema.medewerkers.hoofdDepartmentId),
    ));

  // Departments-lookup voor namen + slugs + werkgeverslasten-percentage
  const deptRijen = await db
    .select({
      id: schema.departments.id,
      slug: schema.departments.slug,
      naam: schema.departments.naam,
      werkgeverslastenPct: schema.departments.werkgeverslastenPct,
    })
    .from(schema.departments);
  const deptMap = new Map(deptRijen.map((d) => [d.id, d]));

  // Opslag-factor voor bedrag-berekening:
  //  - vakantie-opslag: 8,33% vakgeld + 8% verlof = 16,33%
  //  - werkgeverslasten: per uitlenende-vestiging, default 27%
  // Inlenende vestiging betaalt aan de uitlener naar gelang de toggles.
  const vakantieFactor = opties.metVakantieOpslag ? 0.1633 : 0;
  const werkgeverslastFactorVoor = (vanId: number): number => {
    if (!opties.metWerkgeverslasten) return 0;
    const dept = deptMap.get(vanId);
    if (!dept || dept.werkgeverslastenPct === null) return 0.27;
    return Number(dept.werkgeverslastenPct) / 100;
  };

  // Groepeer per (van, naar, medewerker) en accumuleer uren
  // sleutel = `${vanId}|${naarId}|${medewerkerId}`
  const acc = new Map<string, {
    vanId: number; naarId: number;
    medewerkerId: number; voornaam: string; achternaam: string;
    uurloon: number; uren: number;
  }>();

  for (const r of rijen) {
    const vanId = r.hoofdDepartmentId;
    const naarId = r.gewerktDeptId;
    if (vanId === null || vanId === naarId) continue; // niet uitgeleend
    const uren = urenTussen(String(r.start).slice(0, 5), String(r.eind).slice(0, 5), r.pauzeMin ?? 0);
    if (uren <= 0) continue;
    const sleutel = `${vanId}|${naarId}|${r.medewerkerId}`;
    const bestaand = acc.get(sleutel);
    const uurloon = r.uurloon ? Number(r.uurloon) : 0;
    if (bestaand) {
      bestaand.uren += uren;
    } else {
      acc.set(sleutel, {
        vanId, naarId,
        medewerkerId: r.medewerkerId,
        voornaam: r.voornaam,
        achternaam: r.achternaam,
        uurloon,
        uren,
      });
    }
  }

  // Bouw per (van, naar) een paar
  const parenMap = new Map<string, InleenPaar>();
  for (const v of Array.from(acc.values())) {
    const van = deptMap.get(v.vanId);
    const naar = deptMap.get(v.naarId);
    if (!van || !naar) continue;
    const paarSleutel = `${van.slug}|${naar.slug}`;
    let paar = parenMap.get(paarSleutel);
    if (!paar) {
      paar = {
        vanSlug: van.slug, vanNaam: van.naam,
        naarSlug: naar.slug, naarNaam: naar.naam,
        regels: [],
        totaalUren: 0,
        totaalBedrag: 0,
      };
      parenMap.set(paarSleutel, paar);
    }
    const opslagFactor = 1 + vakantieFactor + werkgeverslastFactorVoor(v.vanId);
    const bedrag = Math.round(v.uren * v.uurloon * opslagFactor * 100) / 100;
    paar.regels.push({
      medewerkerId: v.medewerkerId,
      voornaam: v.voornaam,
      achternaam: v.achternaam,
      uren: Math.round(v.uren * 100) / 100,
      uurloon: v.uurloon,
      bedrag,
    });
    paar.totaalUren += v.uren;
    paar.totaalBedrag += bedrag;
  }

  const paren = Array.from(parenMap.values()).map((p) => ({
    ...p,
    totaalUren: Math.round(p.totaalUren * 100) / 100,
    totaalBedrag: Math.round(p.totaalBedrag * 100) / 100,
    // Sorteer regels naam-alfabetisch zodat de output stabiel is
    regels: p.regels.sort((a, b) => a.voornaam.localeCompare(b.voornaam)),
  }));
  // Sorteer paren op totaal-bedrag desc — hoogste te factureren eerst
  paren.sort((a, b) => b.totaalBedrag - a.totaalBedrag);

  const totaalBedrag = paren.reduce((s, p) => s + p.totaalBedrag, 0);

  return { jaar, maand, paren, totaalBedrag: Math.round(totaalBedrag * 100) / 100 };
}
