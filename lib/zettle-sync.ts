/**
 * Zettle → Postgres sync.
 *
 * Idempotent: UNIQUE(bedrijf, purchase_uuid) zorgt voor dedupe. Strategie:
 *  - Backfill: één keer alle historie ophalen via fetchZettleVolledig en in
 *    batches in Postgres knallen. Daarna nooit meer de volledige API.
 *  - Cron (~elke 10 min of dagelijks): alleen purchases na laatste-tx-time
 *    van dat bedrijf, met 5 min overlap-buffer.
 *
 * Reads (forecast, AI-rooster, dashboard, jaarvergelijking) lezen daarna
 * uit `zettle_transacties` — DB-query is milliseconden ipv seconden voor
 * een paginated REST-API.
 */
import { eq, desc } from "drizzle-orm";
import { db, schema } from "./db/client";
import {
  fetchZettleVolledig,
  fetchZettleSinds,
  type Bedrijf,
  type ZettlePurchase,
} from "./zettle";

const BEDRIJVEN: Bedrijf[] = ["bb", "sl", "kl"];

export interface ZettleSyncResult {
  bedrijf: Bedrijf;
  opgehaaldRaw: number;
  ingevoegd: number;
  fout?: string;
}

/**
 * Map een Zettle purchase naar een DB-insert. Zettle geeft amount in centen,
 * we slaan op in euro's (numeric 10,2) zodat de rest van de app er direct
 * mee kan rekenen.
 */
function naarDbRij(bedrijf: Bedrijf, p: ZettlePurchase): typeof schema.zettleTransacties.$inferInsert {
  return {
    bedrijf,
    purchaseUuid: p.purchaseUUID,
    bedrag: (Number(p.amount) / 100).toFixed(2),
    btwBedrag: (Number(p.vatAmount ?? 0) / 100).toFixed(2),
    valuta: p.currency ?? "EUR",
    refund: Boolean(p.refund),
    timestamp: new Date(p.timestamp),
    producten: p.products && p.products.length > 0 ? JSON.stringify(p.products) : null,
  };
}

async function batchInsert(rijen: typeof schema.zettleTransacties.$inferInsert[]): Promise<number> {
  if (rijen.length === 0) return 0;
  // Postgres parameter-limiet: ~65k params per query. Onze rij heeft ~9 cols,
  // dus ~7000 rijen per batch is veilig. Houd 500 aan voor zekerheid.
  let totaal = 0;
  for (let i = 0; i < rijen.length; i += 500) {
    const batch = rijen.slice(i, i + 500);
    const res = await db
      .insert(schema.zettleTransacties)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: schema.zettleTransacties.id });
    totaal += res.length;
  }
  return totaal;
}

async function schrijfSyncState(
  bedrijf: Bedrijf,
  laatsteTxTime: Date | undefined,
  totaalGesynct: number,
  fout: string | null,
): Promise<void> {
  await db
    .insert(schema.zettleSyncState)
    .values({
      bedrijf,
      laatsteSync: new Date(),
      laatsteTxTime,
      totaalGesynct,
      laatsteFout: fout,
    })
    .onConflictDoUpdate({
      target: schema.zettleSyncState.bedrijf,
      set: {
        laatsteSync: new Date(),
        ...(laatsteTxTime ? { laatsteTxTime } : {}),
        totaalGesynct,
        laatsteFout: fout,
      },
    });
}

/**
 * Eenmalige backfill: alles dat Zettle heeft → DB. Loopt minutenlang voor
 * bedrijven met veel historie maar hoeft maar één keer (en gebruikt
 * onConflictDoNothing dus re-run is veilig).
 */
export async function backfillBedrijf(bedrijf: Bedrijf): Promise<ZettleSyncResult> {
  try {
    const purchases = await fetchZettleVolledig(bedrijf);
    const rijen = purchases.map((p) => naarDbRij(bedrijf, p));
    const ingevoegd = await batchInsert(rijen);
    const laatste = rijen.reduce<Date | undefined>((acc, r) => {
      const t = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp as string);
      return !acc || t > acc ? t : acc;
    }, undefined);
    await schrijfSyncState(bedrijf, laatste, ingevoegd, null);
    return { bedrijf, opgehaaldRaw: purchases.length, ingevoegd };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    await schrijfSyncState(bedrijf, undefined, 0, msg).catch(() => null);
    return { bedrijf, opgehaaldRaw: 0, ingevoegd: 0, fout: msg };
  }
}

export async function backfillAlle(): Promise<ZettleSyncResult[]> {
  // Sequentieel — Zettle rate-limits per token zijn al krap, parallel risico
  return Promise.all(BEDRIJVEN.map((b) => backfillBedrijf(b)));
}

/**
 * Bepaal vanaf welk moment we incrementeel synchroniseren: nieuwste tx in
 * DB minus 5 min overlap (refunds/correcties kunnen binnen die marge
 * binnen-druppelen).
 */
async function bepaalCursor(bedrijf: Bedrijf, fallbackDagen = 30): Promise<string> {
  const rows = await db
    .select({ ts: schema.zettleTransacties.timestamp })
    .from(schema.zettleTransacties)
    .where(eq(schema.zettleTransacties.bedrijf, bedrijf))
    .orderBy(desc(schema.zettleTransacties.timestamp))
    .limit(1);
  if (rows.length > 0) {
    const ms = new Date(rows[0].ts).getTime() - 5 * 60 * 1000;
    return new Date(ms).toISOString();
  }
  // Geen historie in DB: pak laatste N dagen via API en stop daarna
  const fallback = new Date(Date.now() - fallbackDagen * 24 * 3600 * 1000);
  return fallback.toISOString();
}

export async function syncBedrijfIncrementeel(bedrijf: Bedrijf): Promise<ZettleSyncResult> {
  try {
    const sinds = await bepaalCursor(bedrijf);
    const purchases = await fetchZettleSinds(bedrijf, sinds);
    const rijen = purchases.map((p) => naarDbRij(bedrijf, p));
    const ingevoegd = await batchInsert(rijen);
    const laatste = rijen.reduce<Date | undefined>((acc, r) => {
      const t = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp as string);
      return !acc || t > acc ? t : acc;
    }, undefined);
    await schrijfSyncState(bedrijf, laatste, ingevoegd, null);
    return { bedrijf, opgehaaldRaw: purchases.length, ingevoegd };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    await schrijfSyncState(bedrijf, undefined, 0, msg).catch(() => null);
    return { bedrijf, opgehaaldRaw: 0, ingevoegd: 0, fout: msg };
  }
}

/** Cron-entrypoint: incrementele sync voor alle bedrijven. */
export async function syncAlleBedrijvenIncrementeel(): Promise<ZettleSyncResult[]> {
  return Promise.all(BEDRIJVEN.map((b) => syncBedrijfIncrementeel(b)));
}

/**
 * Lees-functie voor het dashboard / forecast / AI: haalt alle DB-purchases
 * voor een bedrijf op, terug-gemapt naar ZettlePurchase shape. Pure DB, geen
 * API call. Refunds eruit gefilterd (analoog aan oude API-filter).
 */
export async function leesZettleUitDb(bedrijf: Bedrijf): Promise<ZettlePurchase[]> {
  const rows = await db
    .select()
    .from(schema.zettleTransacties)
    .where(eq(schema.zettleTransacties.bedrijf, bedrijf))
    .orderBy(desc(schema.zettleTransacties.timestamp));

  return rows
    .filter((r) => !r.refund)
    .map((r): ZettlePurchase => ({
      purchaseUUID: r.purchaseUuid,
      timestamp: r.timestamp.toISOString(),
      amount: Math.round(Number(r.bedrag) * 100),
      vatAmount: Math.round(Number(r.btwBedrag ?? 0) * 100),
      currency: r.valuta ?? "EUR",
      refund: r.refund,
      products: r.producten ? (JSON.parse(r.producten) as ZettlePurchase["products"]) : [],
    }));
}
