import { unstable_cache } from "next/cache";

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

function getClientId(bedrijf: Bedrijf): string | null {
  const id =
    bedrijf === "bb"
      ? process.env.ZETTLE_CLIENT_ID_BB
      : process.env.ZETTLE_CLIENT_ID_SL;
  return id ?? null;
}

// Als client_id niet via env is gezet, fallback: haal client_id uit de JWT
// payload zelf. Dit maakt migraties van het ene naar het andere setje env
// vars makkelijker.
function clientIdUitAssertion(assertion: string): string | null {
  try {
    const [, payload] = assertion.split(".");
    if (!payload) return null;
    const decoded = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
    const parsed = JSON.parse(decoded) as { client_id?: string };
    return parsed.client_id ?? null;
  } catch {
    return null;
  }
}

async function getAccessToken(bedrijf: Bedrijf): Promise<string> {
  const assertion = getAssertion(bedrijf);
  const clientId = getClientId(bedrijf) ?? clientIdUitAssertion(assertion);

  if (!clientId) {
    throw new Error(
      `Geen Zettle client_id bekend voor ${bedrijf} — zet ZETTLE_CLIENT_ID_${bedrijf.toUpperCase()} in de env`
    );
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: clientId,
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
  let veiligheidsteller = 0;

  while (veiligheidsteller < 500) {
    veiligheidsteller++;
    const { purchases, lastPurchaseHash: nextHash } =
      await fetchZettlePurchasesPage(accessToken, lastPurchaseHash);

    all.push(...purchases);
    if (!nextHash || purchases.length === 0) break;
    lastPurchaseHash = nextHash;
  }

  return all;
}

// Server-side gecached: Zettle historie verandert niet meer, dus 1h TTL
// is ruim voldoende. Eerste bezoeker na een expire betaalt de paginering,
// daarna serveren alle requests uit de cache.
export const fetchAllZettlePurchasesCached = unstable_cache(
  async (bedrijf: Bedrijf) => fetchAllZettlePurchases(bedrijf),
  ["zettle-all-purchases-v1"],
  { revalidate: 3600, tags: ["zettle"] }
);

export function normalizeZettleToSumUp(purchases: ZettlePurchase[]) {
  return purchases.map((p) => ({
    id: p.purchaseUUID,
    transaction_code: p.purchaseUUID,
    // Zettle geeft bedragen in minor units (centen)
    amount: Number(p.amount) / 100,
    currency: p.currency ?? "EUR",
    timestamp: p.timestamp,
    status: "SUCCESSFUL" as const,
    payment_type: "card" as const,
    products: (p.products ?? []).map((prod) => ({
      name: prod.name,
      price: Number(prod.unitPrice) / 100,
      quantity: Number(prod.quantity) || 0,
    })),
  }));
}
