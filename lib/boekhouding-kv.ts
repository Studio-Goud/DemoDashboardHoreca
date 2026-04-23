import { kv } from "@vercel/kv";
import type { IngTransactie } from "./ing";
import type { Factuur } from "./factuur-ai";
import type { ContantRegel } from "./boekhouding";

type BedrijfSlug = "bb" | "sl" | "kl";

// ─── ING Transacties ───────────────────────────────────────────────────────────

function ingKey(bedrijf: BedrijfSlug, jaar: number, maand: number): string {
  return `adm:ing:${bedrijf}:${jaar}-${String(maand).padStart(2, "0")}`;
}

export async function slaIngOp(
  bedrijf: BedrijfSlug,
  txs: IngTransactie[]
): Promise<void> {
  // Groepeer per maand
  const perMaand = new Map<string, IngTransactie[]>();
  for (const tx of txs) {
    const [jaar, maand] = tx.datum.split("-").map(Number);
    const key = ingKey(bedrijf, jaar, maand);
    if (!perMaand.has(key)) perMaand.set(key, []);
    perMaand.get(key)!.push(tx);
  }

  for (const [key, maandTxs] of Array.from(perMaand.entries())) {
    // Merge met bestaande (dedupliceert op id)
    const bestaand: IngTransactie[] = (await kv.get(key)) ?? [];
    const merged = new Map<string, IngTransactie>();
    for (const tx of bestaand) merged.set(tx.id, tx);
    for (const tx of maandTxs) merged.set(tx.id, tx); // overschrijft bestaande
    await kv.set(key, Array.from(merged.values()));
  }
}

export async function haalIngOp(
  bedrijf: BedrijfSlug,
  jaar: number,
  maanden?: number[]
): Promise<IngTransactie[]> {
  const ms = maanden ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const resultaten: IngTransactie[] = [];
  for (const m of ms) {
    const key = ingKey(bedrijf, jaar, m);
    const data: IngTransactie[] = (await kv.get(key)) ?? [];
    resultaten.push(...data);
  }
  return resultaten.sort((a, b) => a.datum.localeCompare(b.datum));
}

export async function verwijderIngMaand(
  bedrijf: BedrijfSlug,
  jaar: number,
  maand: number
): Promise<void> {
  await kv.del(ingKey(bedrijf, jaar, maand));
}

export async function haalIngKwartaal(
  bedrijf: BedrijfSlug,
  jaar: number,
  kwartaal: 1 | 2 | 3 | 4
): Promise<IngTransactie[]> {
  const start = (kwartaal - 1) * 3 + 1;
  return haalIngOp(bedrijf, jaar, [start, start + 1, start + 2]);
}

export async function updateIngTransactie(
  bedrijf: BedrijfSlug,
  jaar: number,
  maand: number,
  id: string,
  update: Partial<Pick<IngTransactie, "btw21" | "btw9" | "categorie" | "btwStatus">>
): Promise<void> {
  const key = ingKey(bedrijf, jaar, maand);
  const txs: IngTransactie[] = (await kv.get(key)) ?? [];
  const idx = txs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  txs[idx] = { ...txs[idx], ...update, btwStatus: "handmatig" };
  await kv.set(key, txs);
}

// ─── Facturen ─────────────────────────────────────────────────────────────────

function facturenKey(bedrijf: BedrijfSlug, jaar: number): string {
  return `adm:facturen:${bedrijf}:${jaar}`;
}

export async function slaFacturenOp(
  bedrijf: BedrijfSlug,
  facturen: Factuur[]
): Promise<void> {
  const perJaar = new Map<number, Factuur[]>();
  for (const f of facturen) {
    const jaar = Number(f.datum.slice(0, 4));
    if (!perJaar.has(jaar)) perJaar.set(jaar, []);
    perJaar.get(jaar)!.push(f);
  }

  for (const [jaar, jaarFacturen] of Array.from(perJaar.entries())) {
    const key = facturenKey(bedrijf, jaar);
    const bestaand: Factuur[] = (await kv.get(key)) ?? [];
    const merged = new Map<string, Factuur>();
    for (const f of bestaand) merged.set(f.id, f);
    for (const f of jaarFacturen) merged.set(f.id, f);
    await kv.set(key, Array.from(merged.values()));
  }
}

export async function haalFacturenOp(
  bedrijf: BedrijfSlug,
  jaar: number
): Promise<Factuur[]> {
  const key = facturenKey(bedrijf, jaar);
  return (await kv.get(key)) ?? [];
}

export async function updateFactuur(
  bedrijf: BedrijfSlug,
  jaar: number,
  id: string,
  update: Partial<Pick<Factuur, "datum" | "bedragInclBtw" | "bedragExclBtw" | "btw21" | "btw9" | "leverancier" | "status">>
): Promise<void> {
  const key = facturenKey(bedrijf, jaar);
  const facturen: Factuur[] = (await kv.get(key)) ?? [];
  const idx = facturen.findIndex((f) => f.id === id);
  if (idx === -1) return;
  facturen[idx] = { ...facturen[idx], ...update };
  await kv.set(key, facturen);
}

export async function verwijderFactuur(
  bedrijf: BedrijfSlug,
  jaar: number,
  id: string
): Promise<void> {
  const key = facturenKey(bedrijf, jaar);
  const facturen: Factuur[] = (await kv.get(key)) ?? [];
  await kv.set(key, facturen.filter((f) => f.id !== id));
}

// ─── Contant ──────────────────────────────────────────────────────────────────

function contantKey(bedrijf: BedrijfSlug, jaar: number): string {
  return `adm:contant:${bedrijf}:${jaar}`;
}

export async function haalContantOp(
  bedrijf: BedrijfSlug,
  jaar: number
): Promise<ContantRegel[]> {
  const key = contantKey(bedrijf, jaar);
  return (await kv.get(key)) ?? [];
}

export async function voegContantToe(
  bedrijf: BedrijfSlug,
  regel: ContantRegel
): Promise<void> {
  const jaar = Number(regel.datum.slice(0, 4));
  const key = contantKey(bedrijf, jaar);
  const regels: ContantRegel[] = (await kv.get(key)) ?? [];
  // Dedupliceer op id
  const idx = regels.findIndex((r) => r.id === regel.id);
  if (idx >= 0) regels[idx] = regel;
  else regels.push(regel);
  await kv.set(key, regels.sort((a, b) => a.datum.localeCompare(b.datum)));
}

export async function verwijderContant(
  bedrijf: BedrijfSlug,
  jaar: number,
  id: string
): Promise<void> {
  const key = contantKey(bedrijf, jaar);
  const regels: ContantRegel[] = (await kv.get(key)) ?? [];
  await kv.set(key, regels.filter((r) => r.id !== id));
}
