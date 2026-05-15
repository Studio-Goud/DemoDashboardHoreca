/**
 * Gedeelde voorraad (magazijn bij Saté Lounge).
 *
 * - Eén masterlijst met producten, prijs gezet door owner.
 * - Managers van elke vestiging loggen afname: "2 tray cola, 3 doos water…"
 * - Eind van de maand: totale afname × prijs per afnemende vestiging.
 *   SL (de bron) factureert dat bedrag door naar de afnemende vestigingen.
 */
import { and, eq, gte, lt, desc } from "drizzle-orm";
import { db, schema } from "./db/client";

export type BedrijfSlug = "bb" | "sl" | "kl";

/** SL is fysiek waar de gedeelde voorraad staat — factureert alle afnames. */
export const BRON_BEDRIJF: BedrijfSlug = "sl";

export interface GedeeldProduct {
  id: number;
  naam: string;
  categorie: string | null;
  eenheid: string;
  prijsPerEenheid: number | null;
  actief: boolean;
}

export interface AfnameRegel {
  id: number;
  productId: number;
  productNaam: string;
  eenheid: string;
  prijsPerEenheid: number | null;
  voorBedrijf: BedrijfSlug;
  aantal: number;
  bedrag: number | null;
  datum: string;
  doorMedewerkerId: number | null;
  doorMedewerker: string | null;
  notitie: string | null;
}

export interface AfrekeningPerProduct {
  productId: number;
  productNaam: string;
  eenheid: string;
  prijsPerEenheid: number;
  totaalAantal: number;
  totaalBedrag: number;
}

export interface MaandAfrekening {
  jaar: number;
  maand: number;
  /** Per afnemende vestiging een sub-totaal. */
  perBedrijf: Array<{
    bedrijf: BedrijfSlug;
    bedrijfNaam: string;
    regels: AfrekeningPerProduct[];
    totaal: number;
  }>;
  /** Som over alle vestigingen — het bedrag dat SL totaal doorfactureert. */
  totaalBedrag: number;
}

const BEDRIJF_NAMEN: Record<BedrijfSlug, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

export async function listProducten(): Promise<GedeeldProduct[]> {
  const rows = await db
    .select()
    .from(schema.gedeeldeVoorraadProducten)
    .where(eq(schema.gedeeldeVoorraadProducten.actief, true))
    .orderBy(schema.gedeeldeVoorraadProducten.categorie, schema.gedeeldeVoorraadProducten.naam);
  return rows.map((r) => ({
    id: r.id,
    naam: r.naam,
    categorie: r.categorie,
    eenheid: r.eenheid,
    prijsPerEenheid: r.prijsPerEenheid === null ? null : Number(r.prijsPerEenheid),
    actief: r.actief,
  }));
}

export async function voegProductToe(
  naam: string,
  eenheid: string,
  prijsPerEenheid: number | null,
  categorie: string | null,
): Promise<number> {
  const [{ id }] = await db
    .insert(schema.gedeeldeVoorraadProducten)
    .values({
      naam: naam.trim(),
      eenheid: eenheid.trim() || "stuk",
      prijsPerEenheid: prijsPerEenheid === null ? null : String(prijsPerEenheid),
      categorie: categorie?.trim() || null,
    })
    .returning({ id: schema.gedeeldeVoorraadProducten.id });
  return id;
}

export async function bewerkProduct(
  id: number,
  patch: { naam?: string; eenheid?: string; prijsPerEenheid?: number | null; categorie?: string | null; actief?: boolean },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.naam !== undefined)     updates.naam = patch.naam.trim();
  if (patch.eenheid !== undefined)  updates.eenheid = patch.eenheid.trim() || "stuk";
  if (patch.prijsPerEenheid !== undefined) {
    updates.prijsPerEenheid = patch.prijsPerEenheid === null ? null : String(patch.prijsPerEenheid);
  }
  if (patch.categorie !== undefined) updates.categorie = patch.categorie?.trim() || null;
  if (patch.actief !== undefined)    updates.actief = patch.actief;
  if (Object.keys(updates).length === 0) return;
  await db.update(schema.gedeeldeVoorraadProducten).set(updates).where(eq(schema.gedeeldeVoorraadProducten.id, id));
}

export async function logAfname(
  productId: number,
  voorBedrijf: BedrijfSlug,
  aantal: number,
  datum: string,
  doorMedewerkerId: number | null,
  notitie: string | null,
): Promise<number> {
  const [{ id }] = await db
    .insert(schema.gedeeldeVoorraadAfnames)
    .values({
      productId, voorBedrijf,
      aantal: String(aantal),
      datum,
      doorMedewerkerId,
      notitie: notitie?.trim() || null,
    })
    .returning({ id: schema.gedeeldeVoorraadAfnames.id });
  return id;
}

export async function verwijderAfname(id: number): Promise<void> {
  await db.delete(schema.gedeeldeVoorraadAfnames).where(eq(schema.gedeeldeVoorraadAfnames.id, id));
}

/**
 * Recente afnames voor een vestiging — toont in de manager-UI dat de logs
 * doorgekomen zijn. Limit-default 50.
 */
export async function recenteAfnames(voorBedrijf: BedrijfSlug, limit = 50): Promise<AfnameRegel[]> {
  const rows = await db
    .select({
      id: schema.gedeeldeVoorraadAfnames.id,
      productId: schema.gedeeldeVoorraadAfnames.productId,
      productNaam: schema.gedeeldeVoorraadProducten.naam,
      eenheid: schema.gedeeldeVoorraadProducten.eenheid,
      prijsPerEenheid: schema.gedeeldeVoorraadProducten.prijsPerEenheid,
      voorBedrijf: schema.gedeeldeVoorraadAfnames.voorBedrijf,
      aantal: schema.gedeeldeVoorraadAfnames.aantal,
      datum: schema.gedeeldeVoorraadAfnames.datum,
      doorMedewerkerId: schema.gedeeldeVoorraadAfnames.doorMedewerkerId,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
      notitie: schema.gedeeldeVoorraadAfnames.notitie,
    })
    .from(schema.gedeeldeVoorraadAfnames)
    .innerJoin(schema.gedeeldeVoorraadProducten, eq(schema.gedeeldeVoorraadAfnames.productId, schema.gedeeldeVoorraadProducten.id))
    .leftJoin(schema.medewerkers, eq(schema.gedeeldeVoorraadAfnames.doorMedewerkerId, schema.medewerkers.id))
    .where(eq(schema.gedeeldeVoorraadAfnames.voorBedrijf, voorBedrijf))
    .orderBy(desc(schema.gedeeldeVoorraadAfnames.datum), desc(schema.gedeeldeVoorraadAfnames.id))
    .limit(limit);
  return rows.map((r) => {
    const aantal = Number(r.aantal);
    const prijs = r.prijsPerEenheid === null ? null : Number(r.prijsPerEenheid);
    return {
      id: r.id,
      productId: r.productId,
      productNaam: r.productNaam,
      eenheid: r.eenheid,
      prijsPerEenheid: prijs,
      voorBedrijf: r.voorBedrijf as BedrijfSlug,
      aantal,
      bedrag: prijs === null ? null : Math.round(aantal * prijs * 100) / 100,
      datum: r.datum,
      doorMedewerkerId: r.doorMedewerkerId,
      doorMedewerker: r.voornaam ? `${r.voornaam} ${r.achternaam ?? ""}`.trim() : null,
      notitie: r.notitie,
    };
  });
}

/**
 * Maand-afrekening per afnemende vestiging. Producten zonder prijs worden
 * overgeslagen — owner moet de prijs zetten voordat ze in de afrekening
 * verschijnen (anders factureer je €0 wat misleidend is).
 */
export async function maandAfrekening(jaar: number, maand: number): Promise<MaandAfrekening> {
  const startDatum = `${jaar}-${String(maand).padStart(2, "0")}-01`;
  const eindMaand = maand === 12 ? 1 : maand + 1;
  const eindJaar = maand === 12 ? jaar + 1 : jaar;
  const eindDatum = `${eindJaar}-${String(eindMaand).padStart(2, "0")}-01`;

  const rows = await db
    .select({
      productId: schema.gedeeldeVoorraadAfnames.productId,
      productNaam: schema.gedeeldeVoorraadProducten.naam,
      eenheid: schema.gedeeldeVoorraadProducten.eenheid,
      prijsPerEenheid: schema.gedeeldeVoorraadProducten.prijsPerEenheid,
      voorBedrijf: schema.gedeeldeVoorraadAfnames.voorBedrijf,
      aantal: schema.gedeeldeVoorraadAfnames.aantal,
    })
    .from(schema.gedeeldeVoorraadAfnames)
    .innerJoin(schema.gedeeldeVoorraadProducten, eq(schema.gedeeldeVoorraadAfnames.productId, schema.gedeeldeVoorraadProducten.id))
    .where(and(
      gte(schema.gedeeldeVoorraadAfnames.datum, startDatum),
      // Half-open: eindDatum is 1e van volgende maand, exclusive
      lt(schema.gedeeldeVoorraadAfnames.datum, eindDatum),
    ));

  // Groepeer per (bedrijf, product)
  const acc = new Map<string, AfrekeningPerProduct & { bedrijf: BedrijfSlug }>();
  for (const r of rows) {
    if (r.prijsPerEenheid === null) continue; // owner heeft geen prijs gezet
    const aantal = Number(r.aantal);
    const prijs = Number(r.prijsPerEenheid);
    const sleutel = `${r.voorBedrijf}|${r.productId}`;
    const huidig = acc.get(sleutel);
    if (huidig) {
      huidig.totaalAantal += aantal;
      huidig.totaalBedrag += aantal * prijs;
    } else {
      acc.set(sleutel, {
        bedrijf: r.voorBedrijf as BedrijfSlug,
        productId: r.productId,
        productNaam: r.productNaam,
        eenheid: r.eenheid,
        prijsPerEenheid: prijs,
        totaalAantal: aantal,
        totaalBedrag: aantal * prijs,
      });
    }
  }

  // Aggregeer per bedrijf
  const perBedrijfMap = new Map<BedrijfSlug, AfrekeningPerProduct[]>();
  for (const v of Array.from(acc.values())) {
    if (!perBedrijfMap.has(v.bedrijf)) perBedrijfMap.set(v.bedrijf, []);
    perBedrijfMap.get(v.bedrijf)!.push({
      productId: v.productId,
      productNaam: v.productNaam,
      eenheid: v.eenheid,
      prijsPerEenheid: v.prijsPerEenheid,
      totaalAantal: Math.round(v.totaalAantal * 100) / 100,
      totaalBedrag: Math.round(v.totaalBedrag * 100) / 100,
    });
  }

  const perBedrijf = Array.from(perBedrijfMap.entries()).map(([bedrijf, regels]) => {
    // SL heeft geen self-charge — overslaan als per ongeluk gelogd
    if (bedrijf === BRON_BEDRIJF) return null;
    const totaal = regels.reduce((s, r) => s + r.totaalBedrag, 0);
    return {
      bedrijf,
      bedrijfNaam: BEDRIJF_NAMEN[bedrijf],
      regels: regels.sort((a, b) => b.totaalBedrag - a.totaalBedrag),
      totaal: Math.round(totaal * 100) / 100,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // Sorteer op totaal-bedrag DESC zodat grootste afnemer bovenaan
  perBedrijf.sort((a, b) => b.totaal - a.totaal);

  const totaalBedrag = perBedrijf.reduce((s, b) => s + b.totaal, 0);

  return {
    jaar, maand, perBedrijf,
    totaalBedrag: Math.round(totaalBedrag * 100) / 100,
  };
}
