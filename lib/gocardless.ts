// Tink Open Banking (by Visa) — PSD2 tussenpersoon voor ING NL
// Vervangt GoCardless (nieuwe aanmeldingen gestopt per april 2026)

const TINK_BASE = "https://api.tink.com";

// ING Netherlands provider name in Tink
export const ING_PROVIDER_NAME = "ING";
export const ING_MARKET = "NL";

export interface GcToken {
  access: string;
  refresh: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface GcRequisition {
  id: string;
  status: string;
  accounts: string[];
  link: string;
}

export interface GcAccount {
  id: string;
  iban: string;
  name: string;
  currency: string;
}

export interface GcTransaction {
  transactionId?: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  bankTransactionCode?: string;
}

// ─── Auth: Client Credentials token (app-level) ───────────────────────────────

export async function haalNieuwToken(): Promise<GcToken> {
  const res = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TINK_CLIENT_ID ?? "",
      client_secret: process.env.TINK_CLIENT_SECRET ?? "",
      grant_type: "client_credentials",
      scope: "authorization:grant,user:create",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Tink token fout ${res.status}: ${txt}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const nu = Date.now();
  return {
    access: data.access_token,
    refresh: "",
    accessExpiresAt: nu + (data.expires_in - 60) * 1000,
    refreshExpiresAt: nu + 365 * 24 * 60 * 60 * 1000,
  };
}

export async function verversToken(_refreshToken: string): Promise<GcToken> {
  // Tink client credentials tokens kunnen niet worden ververst — haal nieuw op
  return haalNieuwToken();
}

// ─── Gebruikerstoken voor data toegang ────────────────────────────────────────

async function haalGebruikersToken(
  appToken: string,
  externalUserId: string
): Promise<string> {
  // Stap 1: Maak of haal Tink gebruiker op
  const userRes = await fetch(`${TINK_BASE}/api/v1/user/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken}`,
    },
    body: JSON.stringify({
      external_user_id: externalUserId,
      market: ING_MARKET,
      locale: "nl_NL",
    }),
  });

  // 409 = gebruiker bestaat al, dat is ok
  if (!userRes.ok && userRes.status !== 409) {
    const txt = await userRes.text();
    throw new Error(`Tink user create fout ${userRes.status}: ${txt}`);
  }

  // Stap 2: Haal delegate token op voor deze gebruiker
  const delegateRes = await fetch(`${TINK_BASE}/api/v1/oauth/authorization-grant/delegate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${appToken}`,
    },
    body: new URLSearchParams({
      external_user_id: externalUserId,
      scope: "accounts:read,transactions:read,credentials:read",
      actor_client_id: "df05e4b379934cd09963197cc855bfe9",
    }),
  });

  if (!delegateRes.ok) {
    const txt = await delegateRes.text();
    throw new Error(`Tink delegate fout ${delegateRes.status}: ${txt}`);
  }

  const delegateData = await delegateRes.json() as { code: string };

  // Stap 3: Wissel code in voor gebruikerstoken
  const tokenRes = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TINK_CLIENT_ID ?? "",
      client_secret: process.env.TINK_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code: delegateData.code,
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`Tink user token fout ${tokenRes.status}: ${txt}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

// ─── Requisitions (OAuth2 verbinding met bank) ────────────────────────────────

export async function maakRequisition(
  appToken: string,
  redirectUri: string,
  reference: string  // gebruiken als external_user_id
): Promise<{ id: string; link: string }> {
  // Maak link aan voor ING koppeling
  const res = await fetch(`${TINK_BASE}/api/v1/credentials/add/supplemental-information`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${appToken}`,
    },
    body: new URLSearchParams({
      client_id: process.env.TINK_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      external_user_id: reference,
      market: ING_MARKET,
      locale: "nl_NL",
      scope: "accounts:read,transactions:read,credentials:read",
    }),
  });

  // Tink Link URL samenstellen
  const clientId = process.env.TINK_CLIENT_ID ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    market: ING_MARKET,
    locale: "nl_NL",
    scope: "accounts:read,transactions:read,credentials:read",
    external_user_id: reference,
    test: "false",
  });

  const link = `https://link.tink.com/1.0/transactions/connect-accounts?${params}`;
  return { id: reference, link };
}

export async function haalRequisition(
  appToken: string,
  externalUserId: string
): Promise<GcRequisition> {
  // Bij Tink controleren we of er credentials zijn voor de gebruiker
  const userToken = await haalGebruikersToken(appToken, externalUserId);

  const res = await fetch(`${TINK_BASE}/api/v1/credentials/list`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!res.ok) return { id: externalUserId, status: "PENDING", accounts: [], link: "" };

  const data = await res.json() as { credentials: Array<{ id: string; status: string }> };
  const actief = data.credentials.find((c) => c.status === "UPDATED");

  return {
    id: externalUserId,
    status: actief ? "LN" : "PENDING",
    accounts: actief ? [actief.id] : [],
    link: "",
  };
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function haalAccountDetails(
  appToken: string,
  externalUserId: string
): Promise<GcAccount> {
  const userToken = await haalGebruikersToken(appToken, externalUserId);

  const res = await fetch(`${TINK_BASE}/api/v2/accounts`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });

  if (!res.ok) throw new Error(`Tink accounts fout ${res.status}`);

  const data = await res.json() as {
    accounts: Array<{ id: string; identifiers: { iban?: { iban: string } }; name: string; currencyCode: string }>
  };

  const acc = data.accounts[0];
  if (!acc) throw new Error("Geen accounts gevonden");

  return {
    id: externalUserId,
    iban: acc.identifiers?.iban?.iban ?? "",
    name: acc.name ?? "ING Rekening",
    currency: acc.currencyCode ?? "EUR",
  };
}

// ─── Transacties ──────────────────────────────────────────────────────────────

export async function haalTransacties(
  appToken: string,
  externalUserId: string,
  vanDate: string,
  totDate: string
): Promise<{ booked: GcTransaction[]; pending: GcTransaction[] }> {
  const userToken = await haalGebruikersToken(appToken, externalUserId);

  const van = new Date(vanDate).getTime();
  const tot = new Date(totDate).getTime();

  let nextPageToken: string | undefined;
  const alleTxs: GcTransaction[] = [];

  do {
    const params = new URLSearchParams({
      bookedDateGte: vanDate,
      bookedDateLte: totDate,
      pageSize: "100",
      ...(nextPageToken ? { pageToken: nextPageToken } : {}),
    });

    const res = await fetch(`${TINK_BASE}/api/v2/transactions?${params}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    if (!res.ok) break;

    const data = await res.json() as {
      transactions: Array<{
        id: string;
        dates: { booked: string; value?: string };
        amount: { value: { unscaledValue: string; scale: string }; currencyCode: string };
        descriptions: { original?: string; display?: string };
        merchantInformation?: { merchantName?: string };
        reference?: string;
      }>;
      nextPageToken?: string;
    };

    for (const tx of data.transactions) {
      const unscaled = parseInt(tx.amount.value.unscaledValue);
      const scale = parseInt(tx.amount.value.scale);
      const bedrag = (unscaled / Math.pow(10, scale)).toFixed(2);

      alleTxs.push({
        transactionId: tx.id,
        bookingDate: tx.dates.booked,
        valueDate: tx.dates.value,
        transactionAmount: { amount: bedrag, currency: tx.amount.currencyCode },
        creditorName: bedrag.startsWith("-")
          ? (tx.merchantInformation?.merchantName ?? tx.descriptions.display)
          : undefined,
        debtorName: !bedrag.startsWith("-") ? tx.descriptions.display : undefined,
        remittanceInformationUnstructured: tx.descriptions.original ?? tx.descriptions.display,
        bankTransactionCode: tx.reference,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return { booked: alleTxs, pending: [] };
}
