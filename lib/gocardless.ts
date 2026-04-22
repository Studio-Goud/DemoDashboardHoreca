// GoCardless Open Banking (voorheen Nordigen) — PSD2 tussenpersoon voor ING NL

const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

// ING Netherlands institution ID in GoCardless
export const ING_INSTITUTION_ID = "ING_INGBNL2A";

export interface GcToken {
  access: string;
  refresh: string;
  accessExpiresAt: number;  // unix timestamp ms
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function haalNieuwToken(): Promise<GcToken> {
  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret_id: process.env.GC_SECRET_ID,
      secret_key: process.env.GC_SECRET_KEY,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GoCardless token fout ${res.status}: ${txt}`);
  }

  const data = await res.json() as {
    access: string; refresh: string;
    access_expires: number; refresh_expires: number;
  };

  const nu = Date.now();
  return {
    access: data.access,
    refresh: data.refresh,
    accessExpiresAt:  nu + (data.access_expires  - 60) * 1000,
    refreshExpiresAt: nu + (data.refresh_expires - 300) * 1000,
  };
}

export async function verversToken(refreshToken: string): Promise<GcToken> {
  const res = await fetch(`${GC_BASE}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!res.ok) throw new Error(`GoCardless refresh fout ${res.status}`);

  const data = await res.json() as { access: string; access_expires: number };
  return {
    access: data.access,
    refresh: refreshToken,
    accessExpiresAt:  Date.now() + (data.access_expires - 60) * 1000,
    refreshExpiresAt: 0, // ongewijzigd — caller behoudt origineel
  };
}

// ─── Requisitions (OAuth2 verbinding met bank) ────────────────────────────────

export async function maakRequisition(
  accessToken: string,
  redirectUri: string,
  reference: string
): Promise<{ id: string; link: string }> {
  const res = await fetch(`${GC_BASE}/requisitions/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      redirect: redirectUri,
      institution_id: ING_INSTITUTION_ID,
      reference,
      user_language: "NL",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GoCardless requisition fout ${res.status}: ${txt}`);
  }

  const data = await res.json() as { id: string; link: string };
  return { id: data.id, link: data.link };
}

export async function haalRequisition(
  accessToken: string,
  requisitionId: string
): Promise<GcRequisition> {
  const res = await fetch(`${GC_BASE}/requisitions/${requisitionId}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`GoCardless requisition ophalen fout ${res.status}`);
  return res.json() as Promise<GcRequisition>;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function haalAccountDetails(
  accessToken: string,
  accountId: string
): Promise<GcAccount> {
  const res = await fetch(`${GC_BASE}/accounts/${accountId}/details/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`GoCardless account details fout ${res.status}`);
  const data = await res.json() as { account: GcAccount };
  return { ...data.account, id: accountId };
}

// ─── Transacties ──────────────────────────────────────────────────────────────

export async function haalTransacties(
  accessToken: string,
  accountId: string,
  vanDate: string,   // YYYY-MM-DD
  totDate: string    // YYYY-MM-DD
): Promise<{ booked: GcTransaction[]; pending: GcTransaction[] }> {
  const params = new URLSearchParams({ date_from: vanDate, date_to: totDate });
  const res = await fetch(
    `${GC_BASE}/accounts/${accountId}/transactions/?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GoCardless transacties fout ${res.status}: ${txt}`);
  }

  const data = await res.json() as {
    transactions: { booked: GcTransaction[]; pending: GcTransaction[] };
  };
  return data.transactions;
}
