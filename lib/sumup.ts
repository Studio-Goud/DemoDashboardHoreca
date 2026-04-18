import { unstable_cache } from "next/cache";

const SUMUP_BASE = "https://api.sumup.com";

export type Bedrijf = "bb" | "sl" | "kl";

function getKey(bedrijf: Bedrijf): string | undefined {
  return bedrijf === "bb"
    ? process.env.SUMUP_KEY_BB
    : bedrijf === "sl"
    ? process.env.SUMUP_KEY_SL
    : process.env.SUMUP_KEY_KL;
}

export interface SumUpTransaction {
  id: string;
  transaction_code: string;
  amount: number;
  currency: string;
  timestamp: string;
  status: string;
  payment_type: string;
  card?: { type: string };
  products?: Array<{ name: string; price: number; quantity: number }>;
}

interface FetchResult {
  items: SumUpTransaction[];     // gefilterd op SUCCESSFUL
  rawCount: number;              // aantal ruwe items in deze pagina (vóór filter)
  oldest?: SumUpTransaction;     // oudste ruwe item in deze pagina
}

async function fetchPage(
  bedrijf: Bedrijf,
  options: { oldest_time?: string; newest_time?: string; limit?: number } = {}
): Promise<FetchResult> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 100),
    order: "descending",
    ...(options.oldest_time && { oldest_time: options.oldest_time }),
    ...(options.newest_time && { newest_time: options.newest_time }),
  });

  const key = getKey(bedrijf);
  if (!key) return { items: [], rawCount: 0, oldest: undefined };

  const res = await fetch(
    `${SUMUP_BASE}/v0.1/me/transactions/history?${params}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SumUp API fout ${res.status}: ${text}`);
  }

  const data = await res.json();
  const raw: SumUpTransaction[] = data.items ?? [];
  return {
    items: raw.filter((tx) => tx.status === "SUCCESSFUL"),
    rawCount: raw.length,
    oldest: raw[raw.length - 1],
  };
}

// Backwards-compatible: returnt alleen successful items
export async function fetchTransactions(
  bedrijf: Bedrijf,
  options: { oldest_time?: string; newest_time?: string; limit?: number } = {}
): Promise<SumUpTransaction[]> {
  const { items } = await fetchPage(bedrijf, options);
  return items;
}

// Pagineer achteruit door de SumUp-geschiedenis, begrensd tot 2 jaar terug.
// Zettle-snapshot dekt oudere data — geen reden om die ook via SumUp op te
// halen. Grotere page-size (500) vermindert het aantal API-calls en voorkomt
// dat SumUp de verbinding verbreekt na te veel opeenvolgende requests.
export async function fetchAllTransactions(
  bedrijf: Bedrijf
): Promise<SumUpTransaction[]> {
  const LIMIT = 500;
  const all: SumUpTransaction[] = [];
  let newestTime: string | undefined;
  let veiligheidsteller = 0;

  // Haal max 2 jaar terug; Zettle-snapshot dekt de rest.
  const vroegsteGrens = new Date(
    Date.now() - 2 * 365.25 * 24 * 3600 * 1000
  ).toISOString();

  while (veiligheidsteller < 100) {
    veiligheidsteller++;
    const { items, rawCount, oldest } = await fetchPage(bedrijf, {
      newest_time: newestTime,
      oldest_time: vroegsteGrens,
      limit: LIMIT,
    });

    all.push(...items);

    // Geen ruwe items terug → klaar
    if (rawCount === 0 || !oldest) break;

    // Pagina was niet vol → we zijn bij het einde van het venster
    if (rawCount < LIMIT) break;

    // Volgende pagina: stap net voor de oudste timestamp in deze batch
    const oudsteDatum = new Date(oldest.timestamp);
    oudsteDatum.setMilliseconds(oudsteDatum.getMilliseconds() - 1);
    const volgendeNewest = oudsteDatum.toISOString();

    // Voorkomt een oneindige lus als de cursor niet verder komt
    if (volgendeNewest === newestTime) break;
    newestTime = volgendeNewest;
  }

  return all;
}

// Gecached op server (60s TTL). De live /api/sumup endpoint blijft uncached
// voor actuele omzet-per-minuut. Dit pad voedt de historische KPI's en
// de 14-daagse prognose, waar 60s vertraging geen probleem is.
export const fetchAllTransactionsCached = unstable_cache(
  async (bedrijf: Bedrijf) => fetchAllTransactions(bedrijf),
  ["sumup-all-transactions-v2"],
  { revalidate: 60, tags: ["sumup"] }
);
