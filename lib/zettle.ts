const ZETTLE_AUTH_URL = "https://oauth.izettle.com/token";
const ZETTLE_PURCHASE_BASE = "https://purchase.izettle.com";

export type Bedrijf = "bb" | "sl";

function getAssertion(bedrijf: Bedrijf): string {
  const token =
    bedrijf === "bb"
      ? process.env.ZETTLE_TOKEN_BB
      : process.env.ZETTLE_TOKEN_SL;
  if (!token) throw new Error(`Geen Zettle assertion token voor ${bedrijf}`);
  return token;
}

// Wissel de user-assertion JWT in voor een echte access token
async function getAccessToken(bedrijf: Bedrijf): Promise<string> {
  const assertion = getAssertion(bedrijf);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(ZETTLE_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zettle auth fout ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("Geen access_token in Zettle respons");
  return data.access_token as string;
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

async function fetchZettlePurchasesPage(
  accessToken: string,
  lastPurchaseHash?: string
): Promise<{ purchases: ZettlePurchase[]; lastPurchaseHash?: string }> {
  const params = new URLSearchParams({ limit: "1000" });
  if (lastPurchaseHash) params.set("lastPurchaseHash", lastPurchaseHash);

  const res = await fetch(
    `${ZETTLE_PURCHASE_BASE}/purchases/v2?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zettle purchases fout ${res.status}: ${text}`);
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
  const accessToken = await getAccessToken(bedrijf);

  const all: ZettlePurchase[] = [];
  let lastPurchaseHash: string | undefined;

  while (true) {
    const { purchases, lastPurchaseHash: nextHash } =
      await fetchZettlePurchasesPage(accessToken, lastPurchaseHash);

    all.push(...purchases);
    if (!nextHash || purchases.length === 0) break;
    lastPurchaseHash = nextHash;
  }

  return all;
}

export function normalizeZettleToSumUp(purchases: ZettlePurchase[]) {
  return purchases.map((p) => ({
    id: p.purchaseUUID,
    transaction_code: p.purchaseUUID,
    // Zettle geeft bedragen in minor units (centen)
    amount: p.amount / 100,
    currency: p.currency ?? "EUR",
    timestamp: p.timestamp,
    status: "SUCCESSFUL",
    payment_type: "card",
    products: (p.products ?? []).map((prod) => ({
      name: prod.name,
      price: prod.unitPrice / 100,
      quantity: prod.quantity,
    })),
  }));
}
