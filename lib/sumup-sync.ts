/**
 * SumUp → Postgres sync.
 *
 * Idempotent: kan vaker draaien zonder duplicaten (UNIQUE op bedrijf+code).
 * Strategie:
 *  - Voor cron (elke 5 min): haal alleen transacties NA `laatsteTxTime` van die
 *    bedrijf op. Snel, paginatie minimaal.
 *  - Voor historische import: haal alles op vanaf een gegeven startdatum.
 */
import { eq, desc } from "drizzle-orm";
import { db, schema } from "./db/client";
import type { Bedrijf } from "./sumup";

const SUMUP_BASE = "https://api.sumup.com";

function getKey(bedrijf: Bedrijf): string | undefined {
  return bedrijf === "bb"
    ? process.env.SUMUP_KEY_BB
    : bedrijf === "sl"
    ? process.env.SUMUP_KEY_SL
    : process.env.SUMUP_KEY_KL;
}

interface SumUpApiTx {
  id?: string;
  transaction_code: string;
  amount: number | string;
  currency?: string;
  timestamp: string;
  status: string;
  payment_type?: string;
  card?: { type?: string };
}

interface FetchPage {
  items: SumUpApiTx[];
  oldest?: string;          // timestamp van oudste record op deze pagina
  rawCount: number;
}

async function fetchPage(
  bedrijf: Bedrijf,
  options: { oldest_time?: string; newest_time?: string; limit?: number } = {},
): Promise<FetchPage> {
  const key = getKey(bedrijf);
  if (!key) throw new Error(`SUMUP_KEY_${bedrijf.toUpperCase()} ontbreekt`);

  const params = new URLSearchParams({
    limit: String(options.limit ?? 100),
    order: "descending",
    ...(options.oldest_time && { oldest_time: options.oldest_time }),
    ...(options.newest_time && { newest_time: options.newest_time }),
  });

  const res = await fetch(`${SUMUP_BASE}/v0.1/me/transactions/history?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SumUp ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { items?: SumUpApiTx[] };
  const items = data.items ?? [];
  const oldest = items[items.length - 1]?.timestamp;
  return { items, oldest, rawCount: items.length };
}

interface SyncResult {
  bedrijf: Bedrijf;
  opgehaaldRaw: number;       // hoeveel records uit SumUp gehaald
  ingevoegd: number;          // hoeveel nieuw in DB
  fout?: string;
}

/**
 * Sync transacties voor één bedrijf vanaf een datum. `oldestTime` is iso
 * string (bv. "2026-05-12T00:00:00Z"). Als ongedefinieerd → tot SumUp lege
 * pagina terugstuurt (vol historie).
 */
export async function syncBedrijf(
  bedrijf: Bedrijf,
  oldestTime?: string,
): Promise<SyncResult> {
  let opgehaaldRaw = 0;
  let ingevoegd = 0;
  let lastOldest: string | undefined;
  let cursor: string | undefined = undefined;  // newest_time voor volgende page

  try {
    // Loop tot SumUp geen items meer geeft, of tot cursor < oldestTime
    while (true) {
      const opties: { oldest_time?: string; newest_time?: string; limit?: number } = { limit: 100 };
      if (oldestTime) opties.oldest_time = oldestTime;
      if (cursor) opties.newest_time = cursor;

      const page = await fetchPage(bedrijf, opties);
      opgehaaldRaw += page.rawCount;
      if (page.rawCount === 0) break;

      // Filter alleen relevante records (SUCCESSFUL) + map
      const toInsert: typeof schema.sumupTransacties.$inferInsert[] = page.items.map((tx) => ({
        bedrijf,
        transactionCode: tx.transaction_code,
        sumupId: tx.id ?? null,
        bedrag: String(tx.amount),
        valuta: tx.currency ?? "EUR",
        status: tx.status,
        paymentType: tx.payment_type ?? null,
        cardType: tx.card?.type ?? null,
        timestamp: new Date(tx.timestamp),
        ruwJson: null, // weglaten voor compactheid
      }));

      if (toInsert.length > 0) {
        // Batch insert met onConflictDoNothing — duplicaten worden gewoon overgeslagen
        const resBatch = await db.insert(schema.sumupTransacties)
          .values(toInsert)
          .onConflictDoNothing()
          .returning({ id: schema.sumupTransacties.id });
        ingevoegd += resBatch.length;
      }

      lastOldest = page.oldest;
      // Volgende pagina: stel cursor in op oudste timestamp - 1 ms
      if (!page.oldest) break;
      const oldestMs = new Date(page.oldest).getTime();
      if (Number.isNaN(oldestMs)) break;
      cursor = new Date(oldestMs - 1).toISOString();

      // Sanity: stop bij <100 records (laatste pagina)
      if (page.rawCount < 100) break;

      // Sanity 2: als alle nieuwe records waren al in DB (ingevoegd == 0 voor
      // 3 opeenvolgende pagina's), stoppen — verder paginate is verspilling
    }

    // Update sync state
    const tx = lastOldest ? new Date(lastOldest) : undefined;
    await db.insert(schema.sumupSyncState).values({
      bedrijf,
      laatsteSync: new Date(),
      laatsteTxTime: tx,
      totaalGesynct: ingevoegd,
      laatsteFout: null,
    }).onConflictDoUpdate({
      target: schema.sumupSyncState.bedrijf,
      set: {
        laatsteSync: new Date(),
        ...(tx ? { laatsteTxTime: tx } : {}),
        totaalGesynct: ingevoegd,
        laatsteFout: null,
      },
    });

    return { bedrijf, opgehaaldRaw, ingevoegd };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    // Bewaar foutmelding in sync state
    try {
      await db.insert(schema.sumupSyncState).values({
        bedrijf,
        laatsteSync: new Date(),
        totaalGesynct: ingevoegd,
        laatsteFout: msg,
      }).onConflictDoUpdate({
        target: schema.sumupSyncState.bedrijf,
        set: { laatsteSync: new Date(), laatsteFout: msg },
      });
    } catch { /* nest fout negeren */ }
    return { bedrijf, opgehaaldRaw, ingevoegd, fout: msg };
  }
}

/** Bepaal vanaf welk tijdstip we voor dit bedrijf moeten syncen (incremental). */
async function bepaalCursor(bedrijf: Bedrijf, fallbackDagenTerug = 7): Promise<string> {
  // Pak nieuwste tx-timestamp in DB minus 5 min (overlap-veiligheid)
  const rows = await db.select({ ts: schema.sumupTransacties.timestamp })
    .from(schema.sumupTransacties)
    .where(eq(schema.sumupTransacties.bedrijf, bedrijf))
    .orderBy(desc(schema.sumupTransacties.timestamp))
    .limit(1);
  if (rows.length > 0) {
    const ms = new Date(rows[0].ts).getTime() - 5 * 60 * 1000;
    return new Date(ms).toISOString();
  }
  const fallback = new Date(Date.now() - fallbackDagenTerug * 24 * 3600 * 1000);
  return fallback.toISOString();
}

/** Cron-entrypoint: incrementele sync voor alle bedrijven. */
export async function syncAlleBedrijvenIncrementeel(): Promise<SyncResult[]> {
  const bedrijven: Bedrijf[] = ["bb", "sl", "kl"];
  const resultaten = await Promise.all(bedrijven.map(async (b) => {
    const cursor = await bepaalCursor(b);
    return syncBedrijf(b, cursor);
  }));
  return resultaten;
}
