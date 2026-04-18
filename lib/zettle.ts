import { unstable_cache } from "next/cache";
import fs from "node:fs";
import path from "node:path";

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
): Promise<{
  purchases: ZettlePurchase[];
  lastPurchaseHash?: string;
  ruwe: ZettlePurchase[];
}> {
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
  const ruwe = (data.purchases ?? []) as ZettlePurchase[];
  return {
    ruwe,
    purchases: ruwe.filter((p) => !p.refund),
    lastPurchaseHash: data.lastPurchaseHash,
  };
}

// Volledige paginatie — elke purchase, ongeacht leeftijd. Gebruikt door
// het snapshot-script; in productie willen we dit vermijden want het is
// traag.
export async function fetchZettleVolledig(
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

// Incrementele paginatie — stopt zodra de API purchases teruggeeft die
// ouder zijn dan `sinds`. Zettle's purchases/v2 levert purchases in
// omgekeerd chronologische volgorde (newest first), dus we kunnen snel
// stoppen zodra we langs de snapshot-grens gaan.
export async function fetchZettleSinds(
  bedrijf: Bedrijf,
  sinds: string
): Promise<ZettlePurchase[]> {
  const accessToken = await getAccessToken(bedrijf);
  const all: ZettlePurchase[] = [];
  let lastPurchaseHash: string | undefined;
  let veiligheidsteller = 0;

  while (veiligheidsteller < 500) {
    veiligheidsteller++;
    const { purchases, ruwe, lastPurchaseHash: nextHash } =
      await fetchZettlePurchasesPage(accessToken, lastPurchaseHash);

    // Behoud alleen purchases strikt nieuwer dan de snapshot-grens
    const nieuwer = purchases.filter((p) => p.timestamp > sinds);
    all.push(...nieuwer);

    // Als de oudste purchase in de batch niet nieuwer meer is → klaar
    const oudste = ruwe[ruwe.length - 1];
    if (oudste && oudste.timestamp <= sinds) break;
    if (!nextHash || ruwe.length === 0) break;
    lastPurchaseHash = nextHash;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Snapshot: historische Zettle data (2022-nu tot snapshot-moment) staat
// vast in data/zettle-snapshot-{bb,sl}.json. Runtime haalt alleen nieuwere
// purchases via de API op. Dit maakt cold-starts drastisch sneller.
// ---------------------------------------------------------------------------

interface SnapshotBestand {
  bedrijf: string;
  gegenereerd: string | null;
  laatsteTimestamp: string | null;
  aantal: number;
  purchases: ZettlePurchase[];
}

const snapshotCache: Partial<Record<Bedrijf, SnapshotBestand>> = {};

function laadSnapshot(bedrijf: Bedrijf): SnapshotBestand {
  if (snapshotCache[bedrijf]) return snapshotCache[bedrijf]!;
  try {
    const pad = path.join(
      process.cwd(),
      "data",
      `zettle-snapshot-${bedrijf}.json`
    );
    const inhoud = fs.readFileSync(pad, "utf-8");
    const parsed = JSON.parse(inhoud) as SnapshotBestand;
    snapshotCache[bedrijf] = parsed;
    return parsed;
  } catch {
    const leeg: SnapshotBestand = {
      bedrijf,
      gegenereerd: null,
      laatsteTimestamp: null,
      aantal: 0,
      purchases: [],
    };
    snapshotCache[bedrijf] = leeg;
    return leeg;
  }
}

// Publieke functie: snapshot + alleen nieuwere purchases via API.
export async function fetchAllZettlePurchases(
  bedrijf: Bedrijf
): Promise<ZettlePurchase[]> {
  const snapshot = laadSnapshot(bedrijf);

  if (snapshot.aantal > 0 && snapshot.laatsteTimestamp) {
    // Snapshot aanwezig: alleen de delta ophalen
    const recent = await fetchZettleSinds(bedrijf, snapshot.laatsteTimestamp);
    return [...snapshot.purchases, ...recent];
  }

  // Geen snapshot (of leeg): volledige fetch. Traag, maar werkt out-of-the-box.
  return fetchZettleVolledig(bedrijf);
}

// Server-side cache rond de bovenstaande functie. Met een actieve snapshot is
// de onderliggende call snel; zonder snapshot is de cache vangnet tegen zware
// cold starts. 24u TTL want historie-data verandert niet meer.
export const fetchAllZettlePurchasesCached = unstable_cache(
  async (bedrijf: Bedrijf) => fetchAllZettlePurchases(bedrijf),
  ["zettle-all-purchases-v2"],
  { revalidate: 86400, tags: ["zettle"] }
);

export function normalizeZettleToSumUp(purchases: ZettlePurchase[]) {
  return purchases.map((p) => ({
    id: p.purchaseUUID,
    transaction_code: p.purchaseUUID,
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
