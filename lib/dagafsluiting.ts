/**
 * Dagafsluiting business logic.
 *
 * Vervangt het WhatsApp Schoonmaak & Kasrapport. Doel: waterdicht
 * kassa-tellen door medewerker, met live-vergelijking tegen verwachte
 * cash uit POS, en HACCP-temperaturen voor NVWA-controle.
 *
 * Belangrijke berekening (server-side, niet client):
 *   contant_geteld   = som(munten_telling.aantal × waarde)
 *   enveloppe        = contant_geteld - startkassa_doel - fooi
 *   verwacht_contant = som(POS cash-transacties van die datum)
 *   kas_verschil     = enveloppe - verwacht_contant
 *
 * Bij |kas_verschil| > 2 euro is verschil_toelichting verplicht.
 */
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { Bedrijf } from "./sumup";

// ─── Denominaties (Euro-coins/notes) ────────────────────────────────────────
// Sleutels matchen de jsonb-keys van `munten_telling` in DB.
export const DENOMINATIES: Array<{ sleutel: string; label: string; waardeCent: number }> = [
  { sleutel: "200e", label: "€200", waardeCent: 20000 },
  { sleutel: "100e", label: "€100", waardeCent: 10000 },
  { sleutel: "50e",  label: "€50",  waardeCent: 5000 },
  { sleutel: "20e",  label: "€20",  waardeCent: 2000 },
  { sleutel: "10e",  label: "€10",  waardeCent: 1000 },
  { sleutel: "5e",   label: "€5",   waardeCent: 500 },
  { sleutel: "2e",   label: "€2",   waardeCent: 200 },
  { sleutel: "1e",   label: "€1",   waardeCent: 100 },
  { sleutel: "50c",  label: "50c",  waardeCent: 50 },
  { sleutel: "20c",  label: "20c",  waardeCent: 20 },
  { sleutel: "10c",  label: "10c",  waardeCent: 10 },
  { sleutel: "5c",   label: "5c",   waardeCent: 5 },
];

// ─── Per-vestiging config ───────────────────────────────────────────────────
// HACCP-temperatuurpunten en schoonmaak-checks per locatie. Hardcoded — als
// dat moet wijzigen kan owner een PR/edit doen. (Later: admin-UI om te
// beheren via DB-tabel `dagafsluiting_config`.)
export interface VestigingConfig {
  startkassaDoel: number;          // euro
  temperatuurLocaties: Array<{ id: string; label: string; emoji: string; max?: number }>;
  schoonmaakChecks:    Array<{ id: string; label: string }>;
}

const STANDAARD_SCHOONMAAK = [
  { id: "vloer",     label: "Vloer gedweild" },
  { id: "toilet",    label: "Toilet schoongemaakt" },
  { id: "werkbank",  label: "Werkbank afgenomen" },
  { id: "apparatuur",label: "Apparatuur uitgezet en schoon" },
  { id: "afval",     label: "Afval afgevoerd" },
];

export const VESTIGING_CONFIG: Record<string, VestigingConfig> = {
  bb: {
    startkassaDoel: 100,
    temperatuurLocaties: [
      { id: "koeling_keuken", label: "Koeling keuken",    emoji: "🧊", max: 7 },
      { id: "koeling_bar",    label: "Koeling bar",       emoji: "❄️", max: 7 },
      { id: "vriezer",        label: "Vriezer",           emoji: "🧊", max: -15 },
      { id: "melkkoeling",    label: "Melk-koeling",      emoji: "🥛", max: 7 },
    ],
    schoonmaakChecks: STANDAARD_SCHOONMAAK,
  },
  sl: {
    startkassaDoel: 100,
    temperatuurLocaties: [
      { id: "koeling_keuken", label: "Koeling keuken",    emoji: "🧊", max: 7 },
      { id: "vriezer_keuken", label: "Vriezer keuken",    emoji: "🧊", max: -15 },
      { id: "warmhoud",       label: "Warmhoudbak satés", emoji: "🔥" }, // min ipv max
    ],
    schoonmaakChecks: STANDAARD_SCHOONMAAK,
  },
  kl: {
    startkassaDoel: 100,
    temperatuurLocaties: [
      { id: "tosti_koeling", label: "Tosti-koeling",  emoji: "❄️", max: 7 },
      { id: "melk_koeling",  label: "Melk-koeling",   emoji: "🥛", max: 7 },
    ],
    schoonmaakChecks: [
      { id: "vloer",       label: "Vloer gedweild" },
      { id: "werkbank",    label: "Werkbank en kassa afgenomen" },
      { id: "apparatuur",  label: "Tosti-ijzers en koffiemachine schoon" },
      { id: "afval",       label: "Afval afgevoerd" },
    ],
  },
};

export function getVestigingConfig(slug: string): VestigingConfig {
  return VESTIGING_CONFIG[slug] ?? VESTIGING_CONFIG.bb;
}

// ─── Berekeningen ────────────────────────────────────────────────────────────

export function berekenContantGeteld(munten: Record<string, number>): number {
  let cent = 0;
  for (const d of DENOMINATIES) {
    const aantal = munten[d.sleutel] ?? 0;
    cent += aantal * d.waardeCent;
  }
  return cent / 100;
}

/**
 * Verwachte contante omzet voor dag uit POS-transacties.
 *
 * SumUp registreert `payment_type = "CASH"` apart van card-payments (alleen
 * van toepassing als kassier de transactie expliciet als cash markeert in
 * SumUp). Zettle heeft geen aparte cash-classificatie in onze data — die
 * is puur card. Dus: cash = SumUp.paymentType=CASH som.
 *
 * Als de vestiging geen SumUp gebruikt (of nooit cash logt) → 0; dan
 * berekent de UI verschil tegen wat ze tellen vs 0 = 100% verschil. Daarom
 * wordt drempel-controle pas streng als verwacht > €5.
 */
export async function verwachteContanteOmzet(deptSlug: string, datum: string): Promise<number> {
  const startDate = new Date(`${datum}T00:00:00.000Z`);
  const eindDate = new Date(`${datum}T23:59:59.999Z`);

  const sumupCash = await db
    .select({ totaal: schema.sumupTransacties.bedrag })
    .from(schema.sumupTransacties)
    .where(and(
      eq(schema.sumupTransacties.bedrijf, deptSlug),
      eq(schema.sumupTransacties.paymentType, "CASH"),
      gte(schema.sumupTransacties.timestamp, startDate),
      lte(schema.sumupTransacties.timestamp, eindDate),
    ));
  const sumupTotaal = sumupCash.reduce((s, r) => s + Number(r.totaal), 0);

  return Math.round(sumupTotaal * 100) / 100;
}

/** Totale POS-omzet (alle betaalmethoden) voor dag, SumUp + Zettle samen. */
export async function totalePosOmzet(deptSlug: string, datum: string): Promise<number> {
  const startDate = new Date(`${datum}T00:00:00.000Z`);
  const eindDate = new Date(`${datum}T23:59:59.999Z`);

  const sumupAll = await db
    .select({ totaal: schema.sumupTransacties.bedrag })
    .from(schema.sumupTransacties)
    .where(and(
      eq(schema.sumupTransacties.bedrijf, deptSlug),
      gte(schema.sumupTransacties.timestamp, startDate),
      lte(schema.sumupTransacties.timestamp, eindDate),
    ));
  const sumupTotaal = sumupAll.reduce((s, r) => s + Number(r.totaal), 0);

  const zettleAll = await db
    .select({ totaal: schema.zettleTransacties.bedrag })
    .from(schema.zettleTransacties)
    .where(and(
      eq(schema.zettleTransacties.bedrijf, deptSlug),
      gte(schema.zettleTransacties.timestamp, startDate),
      lte(schema.zettleTransacties.timestamp, eindDate),
    ));
  const zettleTotaal = zettleAll.reduce((s, r) => s + Number(r.totaal), 0);

  return Math.round((sumupTotaal + zettleTotaal) * 100) / 100;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function haalDagafsluiting(deptSlug: string, datum: string) {
  const [dept] = await db.select({ id: schema.departments.id })
    .from(schema.departments).where(eq(schema.departments.slug, deptSlug));
  if (!dept) return null;

  const [rij] = await db.select().from(schema.dagafsluitingen).where(and(
    eq(schema.dagafsluitingen.departmentId, dept.id),
    eq(schema.dagafsluitingen.datum, datum),
  ));
  return rij ?? null;
}

export interface DagafsluitingInput {
  deptSlug: string;
  datum: string;
  ingediendDoorId: number;
  startkassaDoel: number;
  munten: Record<string, number>;
  fooi: number;
  temperaturen: Array<{ locatie: string; waardeC: number; opmerking?: string }>;
  schoonmaakChecks: Array<{ label: string; gedaan: boolean; opmerking?: string }>;
  alleSchoonmaakVoltooid: boolean;
  enveloppeInKluis: boolean;
  notitie?: string;
  verschilToelichting?: string;
}

export interface SubmitResultaat {
  ok: boolean;
  contantGeteld: number;
  enveloppe: number;
  verwachtContant: number;
  kasVerschil: number;
  posOmzetTotaal: number;
  toelichtingVereist: boolean;
  dagafsluitingId?: number;
  fout?: string;
}

const DREMPEL_VERSCHIL_EUR = 2;

export async function dienDagafsluitingIn(input: DagafsluitingInput): Promise<SubmitResultaat> {
  const [dept] = await db.select({ id: schema.departments.id })
    .from(schema.departments).where(eq(schema.departments.slug, input.deptSlug));
  if (!dept) {
    return {
      ok: false, contantGeteld: 0, enveloppe: 0, verwachtContant: 0,
      kasVerschil: 0, posOmzetTotaal: 0, toelichtingVereist: false,
      fout: "Vestiging niet gevonden",
    };
  }

  const contantGeteld = berekenContantGeteld(input.munten);
  const enveloppe = Math.round((contantGeteld - input.startkassaDoel - input.fooi) * 100) / 100;
  const [verwachtContant, posOmzetTotaal] = await Promise.all([
    verwachteContanteOmzet(input.deptSlug, input.datum),
    totalePosOmzet(input.deptSlug, input.datum),
  ]);
  const kasVerschil = Math.round((enveloppe - verwachtContant) * 100) / 100;
  const toelichtingVereist = Math.abs(kasVerschil) > DREMPEL_VERSCHIL_EUR;

  if (toelichtingVereist && !input.verschilToelichting?.trim()) {
    return {
      ok: false, contantGeteld, enveloppe, verwachtContant,
      kasVerschil, posOmzetTotaal, toelichtingVereist,
      fout: `Kasverschil €${kasVerschil.toFixed(2)} — toelichting verplicht`,
    };
  }

  // Upsert: één rij per dept × datum
  const bestaand = await haalDagafsluiting(input.deptSlug, input.datum);
  let id: number;

  const waarden = {
    departmentId: dept.id,
    datum: input.datum,
    ingediendDoorId: input.ingediendDoorId,
    startkassaDoel: input.startkassaDoel.toFixed(2),
    contantGeteldEur: contantGeteld.toFixed(2),
    fooiEur: input.fooi.toFixed(2),
    enveloppeEur: enveloppe.toFixed(2),
    verwachtContantEur: verwachtContant.toFixed(2),
    kasVerschilEur: kasVerschil.toFixed(2),
    verschilToelichting: input.verschilToelichting?.trim() || null,
    posOmzetTotaalEur: posOmzetTotaal.toFixed(2),
    muntenTelling: input.munten,
    temperaturen: input.temperaturen.map((t) => ({
      ...t,
      tijdstip: new Date().toISOString(),
    })),
    schoonmaakChecks: input.schoonmaakChecks,
    alleSchoonmaakVoltooid: input.alleSchoonmaakVoltooid,
    enveloppeInKluis: input.enveloppeInKluis,
    notitie: input.notitie?.trim() || null,
    updatedAt: new Date(),
  };

  if (bestaand) {
    // Mag enkel bijgewerkt worden zolang nog niet gecontroleerd
    if (bestaand.gecontroleerdOp) {
      return {
        ok: false, contantGeteld, enveloppe, verwachtContant,
        kasVerschil, posOmzetTotaal, toelichtingVereist,
        fout: "Dagafsluiting is al door manager gecontroleerd — niet meer wijzigbaar",
      };
    }
    await db.update(schema.dagafsluitingen)
      .set(waarden)
      .where(eq(schema.dagafsluitingen.id, bestaand.id));
    id = bestaand.id;
  } else {
    const [ingevoegd] = await db.insert(schema.dagafsluitingen)
      .values({ ...waarden, ingediendOp: new Date() })
      .returning({ id: schema.dagafsluitingen.id });
    id = ingevoegd.id;
  }

  return {
    ok: true,
    contantGeteld, enveloppe, verwachtContant, kasVerschil, posOmzetTotaal,
    toelichtingVereist,
    dagafsluitingId: id,
  };
}

/** Lijst voor admin: per dag overzicht met status. */
export async function dagafsluitingenHistorie(
  deptSlug: string | null,
  vanDatum: string,
  totDatum: string,
) {
  let deptId: number | null = null;
  if (deptSlug) {
    const [d] = await db.select({ id: schema.departments.id })
      .from(schema.departments).where(eq(schema.departments.slug, deptSlug));
    deptId = d?.id ?? null;
    if (!deptId) return [];
  }

  const rows = await db
    .select({
      d: schema.dagafsluitingen,
      deptSlug: schema.departments.slug,
      deptNaam: schema.departments.naam,
      deptHex:  schema.departments.hex,
      doorVoornaam: schema.medewerkers.voornaam,
      doorAchternaam: schema.medewerkers.achternaam,
    })
    .from(schema.dagafsluitingen)
    .innerJoin(schema.departments, eq(schema.dagafsluitingen.departmentId, schema.departments.id))
    .leftJoin(schema.medewerkers, eq(schema.dagafsluitingen.ingediendDoorId, schema.medewerkers.id))
    .where(and(
      gte(schema.dagafsluitingen.datum, vanDatum),
      lte(schema.dagafsluitingen.datum, totDatum),
      ...(deptId ? [eq(schema.dagafsluitingen.departmentId, deptId)] : []),
    ))
    .orderBy(desc(schema.dagafsluitingen.datum));

  return rows.map((r) => ({
    id: r.d.id,
    datum: r.d.datum,
    vestiging: { slug: r.deptSlug, naam: r.deptNaam, hex: r.deptHex },
    ingediendDoor: r.doorVoornaam ? `${r.doorVoornaam} ${r.doorAchternaam ?? ""}`.trim() : null,
    ingediendOp: r.d.ingediendOp.toISOString(),
    contantGeteld: Number(r.d.contantGeteldEur),
    enveloppe: Number(r.d.enveloppeEur),
    kasVerschil: r.d.kasVerschilEur ? Number(r.d.kasVerschilEur) : null,
    verschilToelichting: r.d.verschilToelichting,
    posOmzetTotaal: r.d.posOmzetTotaalEur ? Number(r.d.posOmzetTotaalEur) : null,
    alleSchoonmaakVoltooid: r.d.alleSchoonmaakVoltooid,
    enveloppeInKluis: r.d.enveloppeInKluis,
    gecontroleerdDoor: r.d.gecontroleerdDoor,
    gecontroleerdOp: r.d.gecontroleerdOp?.toISOString() ?? null,
    temperaturen: r.d.temperaturen,
    schoonmaakChecks: r.d.schoonmaakChecks,
    notitie: r.d.notitie,
  }));
}

export async function markeerAlsGecontroleerd(
  id: number,
  doorNaam: string,
  notitie?: string,
): Promise<void> {
  await db.update(schema.dagafsluitingen)
    .set({
      gecontroleerdDoor: doorNaam,
      gecontroleerdOp: new Date(),
      gecontroleerdeNotitie: notitie?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.dagafsluitingen.id, id));
}
