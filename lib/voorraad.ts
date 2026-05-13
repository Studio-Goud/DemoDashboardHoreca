/**
 * Voorraad data-laag — leest/schrijft naar de voorraad-tabellen in Neon.
 */
import { eq, and, asc } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { Bedrijf } from "./sumup";

export type Niveau = "vol" | "laag" | "kritiek" | "op";

export interface Product {
  id: string;
  naam: string;
  eenheid: string;
  categorie: string | null;
  drempelKritiek: number;
  drempelLaag: number;
  kritiekProduct: boolean;
  notitie: string | null;
  volgorde: number;
  aantal: number;
  niveau: Niveau;
  laatsteUpdate: string | null;
  laatsteUpdateDoor: string | null;
}

function bepaalNiveau(aantal: number, drempelKritiek: number, drempelLaag: number): Niveau {
  if (aantal <= 0) return "op";
  if (aantal <= drempelKritiek) return "kritiek";
  if (aantal <= drempelLaag) return "laag";
  return "vol";
}

let slugMap: Record<string, number> | null = null;
async function getDeptId(bedrijf: Bedrijf): Promise<number> {
  if (!slugMap) {
    const rows = await db.select({ id: schema.departments.id, slug: schema.departments.slug })
      .from(schema.departments);
    slugMap = Object.fromEntries(rows.map((r) => [r.slug, r.id]));
  }
  const id = slugMap[bedrijf];
  if (!id) throw new Error(`Onbekend bedrijf: ${bedrijf}`);
  return id;
}

export async function listProducten(bedrijf: Bedrijf): Promise<Product[]> {
  const deptId = await getDeptId(bedrijf);
  const rows = await db.select({
    p: schema.voorraadProducten,
    s_aantal: schema.voorraadStatus.aantal,
    s_update: schema.voorraadStatus.laatsteUpdate,
    s_door:   schema.voorraadStatus.laatsteUpdateDoor,
    m_voornaam: schema.medewerkers.voornaam,
  })
    .from(schema.voorraadProducten)
    .leftJoin(schema.voorraadStatus, eq(schema.voorraadProducten.id, schema.voorraadStatus.productId))
    .leftJoin(schema.medewerkers,    eq(schema.voorraadStatus.laatsteUpdateDoor, schema.medewerkers.id))
    .where(and(
      eq(schema.voorraadProducten.departmentId, deptId),
      eq(schema.voorraadProducten.verwijderd, false),
    ))
    .orderBy(asc(schema.voorraadProducten.volgorde), asc(schema.voorraadProducten.naam));

  return rows.map((r) => {
    const aantal = r.s_aantal === null ? 0 : Number(r.s_aantal);
    return {
      id: String(r.p.id),
      naam: r.p.naam,
      eenheid: r.p.eenheid ?? "stuk",
      categorie: r.p.categorie,
      drempelKritiek: r.p.drempelKritiek ?? 1,
      drempelLaag:    r.p.drempelLaag ?? 3,
      kritiekProduct: r.p.kritiekProduct,
      notitie: r.p.notitie,
      volgorde: r.p.volgorde,
      aantal,
      niveau: bepaalNiveau(aantal, r.p.drempelKritiek ?? 1, r.p.drempelLaag ?? 3),
      laatsteUpdate: r.s_update ? r.s_update.toISOString() : null,
      laatsteUpdateDoor: r.m_voornaam ?? null,
    };
  });
}

export interface NieuwProduct {
  bedrijf: Bedrijf;
  naam: string;
  eenheid?: string;
  categorie?: string;
  drempelKritiek?: number;
  drempelLaag?: number;
  kritiekProduct?: boolean;
  notitie?: string;
}

export async function createProduct(data: NieuwProduct): Promise<{ id: string }> {
  const deptId = await getDeptId(data.bedrijf);
  const ingevoegd = await db.insert(schema.voorraadProducten).values({
    departmentId: deptId,
    naam: data.naam,
    eenheid: data.eenheid ?? "stuk",
    categorie: data.categorie,
    drempelKritiek: data.drempelKritiek ?? 1,
    drempelLaag: data.drempelLaag ?? 3,
    kritiekProduct: data.kritiekProduct ?? false,
    notitie: data.notitie,
  }).returning({ id: schema.voorraadProducten.id });
  const id = ingevoegd[0].id;
  // Initialiseer status op 0
  await db.insert(schema.voorraadStatus).values({ productId: id, aantal: "0" })
    .onConflictDoNothing();
  return { id: String(id) };
}

export interface ProductPatch {
  naam?: string;
  eenheid?: string;
  categorie?: string | null;
  drempelKritiek?: number;
  drempelLaag?: number;
  kritiekProduct?: boolean;
  notitie?: string | null;
  volgorde?: number;
}

export async function updateProduct(id: string, patch: ProductPatch): Promise<void> {
  const updates: Partial<typeof schema.voorraadProducten.$inferInsert> = { updatedAt: new Date() };
  if (patch.naam !== undefined) updates.naam = patch.naam;
  if (patch.eenheid !== undefined) updates.eenheid = patch.eenheid;
  if (patch.categorie !== undefined) updates.categorie = patch.categorie;
  if (patch.drempelKritiek !== undefined) updates.drempelKritiek = patch.drempelKritiek;
  if (patch.drempelLaag !== undefined) updates.drempelLaag = patch.drempelLaag;
  if (patch.kritiekProduct !== undefined) updates.kritiekProduct = patch.kritiekProduct;
  if (patch.notitie !== undefined) updates.notitie = patch.notitie;
  if (patch.volgorde !== undefined) updates.volgorde = patch.volgorde;
  await db.update(schema.voorraadProducten).set(updates).where(eq(schema.voorraadProducten.id, Number(id)));
}

export async function deleteProduct(id: string): Promise<void> {
  // Soft-delete
  await db.update(schema.voorraadProducten).set({
    verwijderd: true,
    updatedAt: new Date(),
  }).where(eq(schema.voorraadProducten.id, Number(id)));
}

export async function setStatus(productId: string, aantal: number, doorMedewerkerId?: number): Promise<void> {
  const id = Number(productId);
  // Upsert
  await db.insert(schema.voorraadStatus).values({
    productId: id,
    aantal: String(aantal),
    laatsteUpdate: new Date(),
    laatsteUpdateDoor: doorMedewerkerId ?? null,
  }).onConflictDoUpdate({
    target: schema.voorraadStatus.productId,
    set: {
      aantal: String(aantal),
      laatsteUpdate: new Date(),
      laatsteUpdateDoor: doorMedewerkerId ?? null,
    },
  });
}

/**
 * Geeft de bestellijst: alle producten met niveau "op", "kritiek" of "laag",
 * over álle vestigingen. Voor het admin-dashboard.
 */
export async function bestellijstAlleVestigingen(): Promise<Array<Product & { bedrijf: Bedrijf; vestigingNaam: string }>> {
  const rows = await db.select({
    p: schema.voorraadProducten,
    s_aantal: schema.voorraadStatus.aantal,
    s_update: schema.voorraadStatus.laatsteUpdate,
    d_slug: schema.departments.slug,
    d_naam: schema.departments.naam,
  })
    .from(schema.voorraadProducten)
    .innerJoin(schema.departments,   eq(schema.voorraadProducten.departmentId, schema.departments.id))
    .leftJoin (schema.voorraadStatus, eq(schema.voorraadProducten.id, schema.voorraadStatus.productId))
    .where(eq(schema.voorraadProducten.verwijderd, false));

  const result: Array<Product & { bedrijf: Bedrijf; vestigingNaam: string }> = [];
  for (const r of rows) {
    const aantal = r.s_aantal === null ? 0 : Number(r.s_aantal);
    const niveau = bepaalNiveau(aantal, r.p.drempelKritiek ?? 1, r.p.drempelLaag ?? 3);
    if (niveau === "vol") continue;
    result.push({
      id: String(r.p.id),
      naam: r.p.naam,
      eenheid: r.p.eenheid ?? "stuk",
      categorie: r.p.categorie,
      drempelKritiek: r.p.drempelKritiek ?? 1,
      drempelLaag:    r.p.drempelLaag ?? 3,
      kritiekProduct: r.p.kritiekProduct,
      notitie: r.p.notitie,
      volgorde: r.p.volgorde,
      aantal,
      niveau,
      laatsteUpdate: r.s_update ? r.s_update.toISOString() : null,
      laatsteUpdateDoor: null,
      bedrijf: r.d_slug as Bedrijf,
      vestigingNaam: r.d_naam,
    });
  }
  // Sorteer op urgentie: kritiek-product+op eerst, dan kritiek, dan laag
  const prio: Record<Niveau, number> = { op: 0, kritiek: 1, laag: 2, vol: 3 };
  result.sort((a, b) => {
    const aPrio = prio[a.niveau] - (a.kritiekProduct ? 0.5 : 0);
    const bPrio = prio[b.niveau] - (b.kritiekProduct ? 0.5 : 0);
    return aPrio - bPrio;
  });
  return result;
}
