const SUMUP_BASE = "https://api.sumup.com";

export type Bedrijf = "bb" | "sl";

function getKey(bedrijf: Bedrijf): string {
  const key =
    bedrijf === "bb"
      ? process.env.SUMUP_KEY_BB
      : process.env.SUMUP_KEY_SL;
  if (!key) throw new Error(`Geen SumUp key voor ${bedrijf}`);
  return key;
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

export async function fetchTransactions(
  bedrijf: Bedrijf,
  options: { oldest_time?: string; newest_time?: string; limit?: number } = {}
): Promise<SumUpTransaction[]> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 100),
    order: "descending",
    statuses: "SUCCESSFUL",
    ...(options.oldest_time && { oldest_time: options.oldest_time }),
    ...(options.newest_time && { newest_time: options.newest_time }),
  });

  const res = await fetch(
    `${SUMUP_BASE}/v0.1/me/transactions/history?${params}`,
    {
      headers: { Authorization: `Bearer ${getKey(bedrijf)}` },
      next: { revalidate: 30 },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SumUp API fout ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.items ?? [];
}

// Haalt de volledige geschiedenis op (geen datelimit) door te pagineren
export async function fetchAllTransactions(
  bedrijf: Bedrijf
): Promise<SumUpTransaction[]> {
  const all: SumUpTransaction[] = [];
  // SumUp gaat terug tot het allereerste account-gebruik
  let oldestTime = "2018-01-01T00:00:00.000Z";
  let keepGoing = true;

  while (keepGoing) {
    const batch = await fetchTransactions(bedrijf, {
      oldest_time: oldestTime,
      limit: 100,
    });
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) {
      keepGoing = false;
    } else {
      // Volgende batch na de laatste timestamp
      const last = batch[batch.length - 1];
      const lastDate = new Date(last.timestamp);
      lastDate.setMilliseconds(lastDate.getMilliseconds() + 1);
      oldestTime = lastDate.toISOString();
    }
  }

  return all;
}
