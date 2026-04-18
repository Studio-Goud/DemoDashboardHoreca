const ZETTLE_PURCHASE_BASE = "https://purchase.izettle.com";

export type Bedrijf = "bb" | "sl";

function getToken(bedrijf: Bedrijf): string {
  const token =
    bedrijf === "bb"
      ? process.env.ZETTLE_TOKEN_BB
      : process.env.ZETTLE_TOKEN_SL;
  if (!token) throw new Error(`Geen Zettle token voor ${bedrijf}`);
  return token;
}

export interface ZettleProduct {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface ZettlePurchase {
  purchaseUUID: string;
  timestamp: string;
  amount: number;
  vatAmount: number;
  currency: string;
  products: ZettleProduct[];
  refund: boolean;
}

export async function fetchZettlePurchases(
  bedrijf: Bedrijf,
  options: { lastPurchaseHash?: string; limit?: number } = {}
): Promise<{ purchases: ZettlePurchase[]; lastPurchaseHash?: string }> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 1000),
    ...(options.lastPurchaseHash && {
      lastPurchaseHash: options.lastPurchaseHash,
    }),
  });

  const res = await fetch(
    `${ZETTLE_PURCHASE_BASE}/purchases/v2?${params}`,
    {
      headers: {
        Authorization: `Bearer ${getToken(bedrijf)}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zettle API fout ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    purchases: (data.purchases ?? []).filter((p: ZettlePurchase) => !p.refund),
    lastPurchaseHash: data.lastPurchaseHash,
  };
}

export async function fetchAllZettlePurchases(
  bedrijf: Bedrijf
): Promise<ZettlePurchase[]> {
  const all: ZettlePurchase[] = [];
  let lastPurchaseHash: string | undefined;

  // Pagineer door alle historische aankopen
  while (true) {
    const { purchases, lastPurchaseHash: nextHash } =
      await fetchZettlePurchases(bedrijf, { lastPurchaseHash, limit: 1000 });

    all.push(...purchases);

    if (!nextHash || purchases.length === 0) break;
    lastPurchaseHash = nextHash;
  }

  return all;
}

// Converteer Zettle purchases naar hetzelfde formaat als SumUp transactions
export function normalizeZettleToSumUp(purchases: ZettlePurchase[]) {
  return purchases.map((p) => ({
    id: p.purchaseUUID,
    transaction_code: p.purchaseUUID,
    amount: p.amount / 100, // Zettle geeft bedragen in centen
    currency: p.currency,
    timestamp: p.timestamp,
    status: "SUCCESSFUL",
    payment_type: "card",
    products: p.products.map((prod) => ({
      name: prod.name,
      price: prod.unitPrice / 100,
      quantity: prod.quantity,
    })),
  }));
}
