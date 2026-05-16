/**
 * Ruilverzoek-flow business logic.
 *
 * State-machine:
 *   open          → een collega klikt "Ik neem 'm over"
 *     → gereserveerd → manager keurt goed → goedgekeurd (rooster aangepast)
 *                    → manager wijst af → open (overnemer wordt gewist)
 *     → aanvrager trekt 'm zelf in → ingetrokken
 *
 * Bij overgang naar gereserveerd: push naar aanvrager + alle managers van
 * de vestiging.
 * Bij goedkeuring: rooster.medewerker_id wijzigt + audit-log entry.
 */
import { and, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "./db/client";
import { logAudit } from "./audit";
import { stuurNaarMedewerkers, medewerkersInVestiging } from "./medewerker-push";

const STATUS = {
  open: "open",
  gereserveerd: "gereserveerd",
  goedgekeurd: "goedgekeurd",
  geweigerd: "geweigerd",
  ingetrokken: "ingetrokken",
  verlopen: "verlopen",
} as const;

export type RuilverzoekStatus = (typeof STATUS)[keyof typeof STATUS];

export interface RuilverzoekRij {
  id: number;
  status: RuilverzoekStatus;
  toelichting: string | null;
  aangemaaktOp: string;
  dienst: {
    rosterId: number;
    datum: string;        // YYYY-MM-DD
    start: string;        // HH:MM
    eind: string;         // HH:MM
    vestiging: { slug: string; naam: string; hex: string };
  };
  aanvrager: { id: number; naam: string };
  overnemer: { id: number; naam: string } | null;
}

/**
 * Lees ruilverzoeken die voor `medewerkerId` relevant zijn:
 *   - eigen aanvragen (alle statussen)
 *   - open aanvragen van collega's in dezelfde vestiging (om te kunnen
 *     accepteren)
 *
 * Verzoeken voor diensten die al gepasseerd zijn worden gefilterd uit
 * de inbox (komen via een aparte 'verlopen' status terecht).
 */
export async function ruilverzoekenInbox(medewerkerId: number): Promise<RuilverzoekRij[]> {
  // 1. Eigen vestigingen
  const eigenDepts = await db
    .select({ slug: schema.departments.slug })
    .from(schema.medewerkerDepartments)
    .innerJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
    .where(eq(schema.medewerkerDepartments.medewerkerId, medewerkerId));
  const slugs = eigenDepts.map((r) => r.slug);

  // 2. Verzoeken — joinen op rosters + departments + aanvrager
  const vandaag = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date()));

  const rows = await db
    .select({
      r: schema.ruilverzoeken,
      roster: schema.rosters,
      dept: schema.departments,
      aanvragerVN: schema.medewerkers.voornaam,
      aanvragerAN: schema.medewerkers.achternaam,
    })
    .from(schema.ruilverzoeken)
    .innerJoin(schema.rosters, eq(schema.ruilverzoeken.rosterId, schema.rosters.id))
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .innerJoin(schema.medewerkers, eq(schema.ruilverzoeken.aanvragerId, schema.medewerkers.id))
    .where(gte(schema.rosters.datum, vandaag.toISOString().slice(0, 10)));

  // Overnemer-namen los ophalen (kleine N)
  const overnemerIds = Array.from(new Set(
    rows.map((r) => r.r.overnemerId).filter((x): x is number => x !== null),
  ));
  const overnemers = overnemerIds.length > 0
    ? await db.select({
        id: schema.medewerkers.id,
        voornaam: schema.medewerkers.voornaam,
        achternaam: schema.medewerkers.achternaam,
      }).from(schema.medewerkers).where(inArray(schema.medewerkers.id, overnemerIds))
    : [];
  const overnemerMap = new Map(overnemers.map((m) => [m.id, `${m.voornaam} ${m.achternaam}`.trim()]));

  // Filter: ofwel eigen verzoek, ofwel open verzoek in eigen vestiging
  const relevant = rows.filter((row) => {
    const isEigen = row.r.aanvragerId === medewerkerId;
    const isOpenInMijnVestiging = row.r.status === STATUS.open && slugs.includes(row.dept.slug);
    return isEigen || isOpenInMijnVestiging;
  });

  return relevant.map((row): RuilverzoekRij => ({
    id: row.r.id,
    status: row.r.status as RuilverzoekStatus,
    toelichting: row.r.toelichting,
    aangemaaktOp: row.r.createdAt.toISOString(),
    dienst: {
      rosterId: row.roster.id,
      datum: row.roster.datum,
      start: row.roster.start.slice(0, 5),
      eind: row.roster.eind.slice(0, 5),
      vestiging: {
        slug: row.dept.slug,
        naam: row.dept.naam,
        hex: row.dept.hex,
      },
    },
    aanvrager: {
      id: row.r.aanvragerId,
      naam: `${row.aanvragerVN} ${row.aanvragerAN}`.trim(),
    },
    overnemer: row.r.overnemerId
      ? { id: row.r.overnemerId, naam: overnemerMap.get(row.r.overnemerId) ?? "?" }
      : null,
  }));
}

/**
 * Maak een ruilverzoek aan en stuur push naar collega's in dezelfde vestiging
 * (exclusief aanvrager zelf).
 */
export async function maakRuilverzoek(input: {
  rosterId: number;
  aanvragerId: number;
  toelichting?: string;
}): Promise<{ id: number; doelAantal: number }> {
  // Roster + department ophalen voor message + targeting
  const [rosterRij] = await db
    .select({
      id: schema.rosters.id,
      medewerkerId: schema.rosters.medewerkerId,
      datum: schema.rosters.datum,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      deptSlug: schema.departments.slug,
      deptNaam: schema.departments.naam,
    })
    .from(schema.rosters)
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .where(eq(schema.rosters.id, input.rosterId));

  if (!rosterRij) throw new Error("Dienst niet gevonden");
  if (rosterRij.medewerkerId !== input.aanvragerId) {
    throw new Error("Je kunt alleen een ruilverzoek voor je eigen dienst aanmaken");
  }

  // Aanvrager-naam voor in de push-titel
  const [aanvrager] = await db
    .select({ voornaam: schema.medewerkers.voornaam })
    .from(schema.medewerkers).where(eq(schema.medewerkers.id, input.aanvragerId));

  // Insert
  const [nieuw] = await db.insert(schema.ruilverzoeken).values({
    rosterId: input.rosterId,
    aanvragerId: input.aanvragerId,
    toelichting: input.toelichting ?? null,
    status: STATUS.open,
  }).returning({ id: schema.ruilverzoeken.id });

  await logAudit("ruilverzoek", nieuw.id, "create", null, {
    rosterId: input.rosterId,
    aanvragerId: input.aanvragerId,
    toelichting: input.toelichting,
  }, { doorMedewerkerId: input.aanvragerId, doorRol: "medewerker" });

  // Push naar collega's in dezelfde vestiging (exclusief aanvrager)
  const collegaIds = await medewerkersInVestiging(rosterRij.deptSlug, [input.aanvragerId]);
  const datumNL = nederlandseDatum(rosterRij.datum);
  await stuurNaarMedewerkers(collegaIds, {
    titel: `${aanvrager?.voornaam ?? "Collega"} zoekt ruilpartner`,
    body: `${datumNL} · ${rosterRij.start.slice(0, 5)}-${rosterRij.eind.slice(0, 5)} bij ${rosterRij.deptNaam}. Kun jij overnemen?`,
    url: "/m",
    tag: `ruilverzoek-${nieuw.id}`,
  });

  return { id: nieuw.id, doelAantal: collegaIds.length };
}

/**
 * Een collega claimt het verzoek. Status → gereserveerd; overige collega's
 * krijgen géén push meer (eerste-die-klikt-wint). Manager(s) krijgen
 * een notificatie ter goedkeuring.
 */
export async function reserveerRuilverzoek(input: {
  ruilverzoekId: number;
  overnemerId: number;
}): Promise<void> {
  // Optimistic update: alleen als status nog 'open' is.
  const result = await db.update(schema.ruilverzoeken)
    .set({
      status: STATUS.gereserveerd,
      overnemerId: input.overnemerId,
      overnemerGereserveerdOp: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.ruilverzoeken.id, input.ruilverzoekId),
      eq(schema.ruilverzoeken.status, STATUS.open),
    ))
    .returning({
      id: schema.ruilverzoeken.id,
      rosterId: schema.ruilverzoeken.rosterId,
      aanvragerId: schema.ruilverzoeken.aanvragerId,
    });

  if (result.length === 0) {
    throw new Error("Verzoek is al door iemand anders opgepakt of niet meer open");
  }
  const r = result[0];

  await logAudit("ruilverzoek", r.id, "update", { status: STATUS.open }, {
    status: STATUS.gereserveerd,
    overnemerId: input.overnemerId,
  }, { doorMedewerkerId: input.overnemerId, doorRol: "medewerker" });

  // Push naar aanvrager + alle managers (admin-PIN systeem geeft hun device
  // niet weer, dus we sturen naar de aanvrager direct, plus loggen voor
  // owner-view; manager-goedkeuring loopt via /administratie).
  const [overnemer] = await db
    .select({ voornaam: schema.medewerkers.voornaam, achternaam: schema.medewerkers.achternaam })
    .from(schema.medewerkers).where(eq(schema.medewerkers.id, input.overnemerId));

  const [roster] = await db.select({
    datum: schema.rosters.datum,
    start: schema.rosters.start,
    deptNaam: schema.departments.naam,
  }).from(schema.rosters)
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .where(eq(schema.rosters.id, r.rosterId));

  if (roster) {
    await stuurNaarMedewerkers([r.aanvragerId], {
      titel: "Iemand wil je dienst overnemen",
      body: `${overnemer?.voornaam ?? "Een collega"} wacht op manager-goedkeuring (${nederlandseDatum(roster.datum)} ${roster.start.slice(0,5)} · ${roster.deptNaam}).`,
      url: "/m",
      tag: `ruilverzoek-${r.id}-gereserveerd`,
    });
  }
}

/**
 * Manager keurt het verzoek goed: rooster.medewerker_id wijzigt naar overnemer,
 * status → goedgekeurd. Stuur push naar aanvrager + overnemer.
 */
export async function keurRuilverzoekGoed(input: {
  ruilverzoekId: number;
  managerNaam: string;
  managerRol: "owner" | "manager";
  notitie?: string;
}): Promise<void> {
  const [r] = await db.select().from(schema.ruilverzoeken).where(eq(schema.ruilverzoeken.id, input.ruilverzoekId));
  if (!r) throw new Error("Verzoek niet gevonden");
  if (r.status !== STATUS.gereserveerd) {
    throw new Error("Verzoek moet status 'gereserveerd' hebben om goedgekeurd te worden");
  }
  if (!r.overnemerId) throw new Error("Geen overnemer geregistreerd");

  const oudeMedewerkerId = (await db.select({ id: schema.rosters.medewerkerId })
    .from(schema.rosters).where(eq(schema.rosters.id, r.rosterId)))[0]?.id;

  // Rooster aanpassen
  await db.update(schema.rosters)
    .set({ medewerkerId: r.overnemerId })
    .where(eq(schema.rosters.id, r.rosterId));

  // Ruilverzoek afronden
  await db.update(schema.ruilverzoeken).set({
    status: STATUS.goedgekeurd,
    beoordeeldOp: new Date(),
    beoordelingsNotitie: input.notitie ?? null,
    updatedAt: new Date(),
  }).where(eq(schema.ruilverzoeken.id, input.ruilverzoekId));

  await logAudit("ruilverzoek", input.ruilverzoekId, "approve",
    { oudeMedewerkerId, status: STATUS.gereserveerd },
    { nieuweMedewerkerId: r.overnemerId, status: STATUS.goedgekeurd, door: input.managerNaam },
    { doorRol: input.managerRol, reden: input.notitie },
  );
  await logAudit("roster", r.rosterId, "update",
    { medewerkerId: oudeMedewerkerId },
    { medewerkerId: r.overnemerId, viaRuilverzoek: input.ruilverzoekId },
    { doorRol: input.managerRol, reden: `Ruilverzoek #${input.ruilverzoekId} goedgekeurd door ${input.managerNaam}` },
  );

  // Push beide kanten
  const [roster] = await db.select({
    datum: schema.rosters.datum,
    start: schema.rosters.start,
    deptNaam: schema.departments.naam,
  }).from(schema.rosters)
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .where(eq(schema.rosters.id, r.rosterId));

  if (roster) {
    const tekst = `${nederlandseDatum(roster.datum)} ${roster.start.slice(0, 5)} · ${roster.deptNaam}`;
    await stuurNaarMedewerkers([r.aanvragerId, r.overnemerId], {
      titel: "Ruilverzoek goedgekeurd ✓",
      body: `Rooster is bijgewerkt: ${tekst}.`,
      url: "/m",
      tag: `ruilverzoek-${r.id}-goedgekeurd`,
    });
  }
}

/** Manager wijst af: status → open (terug in de markt). */
export async function weigerRuilverzoek(input: {
  ruilverzoekId: number;
  managerNaam: string;
  managerRol: "owner" | "manager";
  notitie?: string;
}): Promise<void> {
  const [r] = await db.select().from(schema.ruilverzoeken).where(eq(schema.ruilverzoeken.id, input.ruilverzoekId));
  if (!r) throw new Error("Verzoek niet gevonden");
  if (r.status !== STATUS.gereserveerd) {
    throw new Error("Alleen gereserveerde verzoeken kunnen geweigerd worden");
  }

  await db.update(schema.ruilverzoeken).set({
    status: STATUS.open,
    overnemerId: null,
    overnemerGereserveerdOp: null,
    beoordeeldOp: new Date(),
    beoordelingsNotitie: input.notitie ?? null,
    updatedAt: new Date(),
  }).where(eq(schema.ruilverzoeken.id, input.ruilverzoekId));

  await logAudit("ruilverzoek", input.ruilverzoekId, "revoke",
    { status: STATUS.gereserveerd, overnemerId: r.overnemerId },
    { status: STATUS.open, door: input.managerNaam, notitie: input.notitie },
    { doorRol: input.managerRol },
  );

  if (r.overnemerId) {
    await stuurNaarMedewerkers([r.overnemerId, r.aanvragerId], {
      titel: "Ruilverzoek niet goedgekeurd",
      body: input.notitie?.trim() || "Manager heeft het verzoek niet goedgekeurd. Iemand anders mag het oppakken.",
      url: "/m",
      tag: `ruilverzoek-${input.ruilverzoekId}-geweigerd`,
    });
  }
}

/** Aanvrager trekt 'm zelf in (alleen als nog open of gereserveerd). */
export async function trekRuilverzoekIn(input: {
  ruilverzoekId: number;
  aanvragerId: number;
}): Promise<void> {
  const result = await db.update(schema.ruilverzoeken).set({
    status: STATUS.ingetrokken,
    updatedAt: new Date(),
  }).where(and(
    eq(schema.ruilverzoeken.id, input.ruilverzoekId),
    eq(schema.ruilverzoeken.aanvragerId, input.aanvragerId),
    inArray(schema.ruilverzoeken.status, [STATUS.open, STATUS.gereserveerd]),
  )).returning({ id: schema.ruilverzoeken.id, overnemerId: schema.ruilverzoeken.overnemerId });

  if (result.length === 0) {
    throw new Error("Verzoek niet gevonden of kan niet meer ingetrokken worden");
  }
  await logAudit("ruilverzoek", input.ruilverzoekId, "delete", null, {
    door: "aanvrager",
    status: STATUS.ingetrokken,
  }, { doorMedewerkerId: input.aanvragerId, doorRol: "medewerker" });

  if (result[0].overnemerId) {
    await stuurNaarMedewerkers([result[0].overnemerId], {
      titel: "Ruilverzoek ingetrokken",
      body: "De aanvrager heeft het verzoek teruggetrokken — je hoeft de dienst niet over te nemen.",
      url: "/m",
      tag: `ruilverzoek-${input.ruilverzoekId}-ingetrokken`,
    });
  }
}

/** Lijst van wachten-op-goedkeuring (voor owner/manager dashboard). */
export async function teBeoordelen(filterVestigingSlug?: string): Promise<RuilverzoekRij[]> {
  const rows = await db
    .select({
      r: schema.ruilverzoeken,
      roster: schema.rosters,
      dept: schema.departments,
      aanvragerVN: schema.medewerkers.voornaam,
      aanvragerAN: schema.medewerkers.achternaam,
    })
    .from(schema.ruilverzoeken)
    .innerJoin(schema.rosters, eq(schema.ruilverzoeken.rosterId, schema.rosters.id))
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .innerJoin(schema.medewerkers, eq(schema.ruilverzoeken.aanvragerId, schema.medewerkers.id))
    .where(eq(schema.ruilverzoeken.status, STATUS.gereserveerd));

  const gefilterd = filterVestigingSlug
    ? rows.filter((r) => r.dept.slug === filterVestigingSlug)
    : rows;

  const overnemerIds = Array.from(new Set(
    gefilterd.map((r) => r.r.overnemerId).filter((x): x is number => x !== null),
  ));
  const overnemers = overnemerIds.length > 0
    ? await db.select({
        id: schema.medewerkers.id,
        voornaam: schema.medewerkers.voornaam,
        achternaam: schema.medewerkers.achternaam,
      }).from(schema.medewerkers).where(inArray(schema.medewerkers.id, overnemerIds))
    : [];
  const overnemerMap = new Map(overnemers.map((m) => [m.id, `${m.voornaam} ${m.achternaam}`.trim()]));

  return gefilterd.map((row): RuilverzoekRij => ({
    id: row.r.id,
    status: row.r.status as RuilverzoekStatus,
    toelichting: row.r.toelichting,
    aangemaaktOp: row.r.createdAt.toISOString(),
    dienst: {
      rosterId: row.roster.id,
      datum: row.roster.datum,
      start: row.roster.start.slice(0, 5),
      eind: row.roster.eind.slice(0, 5),
      vestiging: {
        slug: row.dept.slug,
        naam: row.dept.naam,
        hex: row.dept.hex,
      },
    },
    aanvrager: {
      id: row.r.aanvragerId,
      naam: `${row.aanvragerVN} ${row.aanvragerAN}`.trim(),
    },
    overnemer: row.r.overnemerId
      ? { id: row.r.overnemerId, naam: overnemerMap.get(row.r.overnemerId) ?? "?" }
      : null,
  }));
}

function nederlandseDatum(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dt);
}
