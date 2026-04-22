import { kv } from "@vercel/kv";
import type { GcToken, GcAccount } from "./gocardless";
import { haalNieuwToken, verversToken } from "./gocardless";

type BedrijfSlug = "bb" | "sl" | "kl";

// ─── Token beheer ─────────────────────────────────────────────────────────────

export async function getGeldigToken(): Promise<string> {
  const opgeslagen = await kv.get<GcToken>("gc:token");

  if (opgeslagen && Date.now() < opgeslagen.accessExpiresAt) {
    return opgeslagen.access;
  }

  let nieuw: GcToken;
  if (opgeslagen && Date.now() < opgeslagen.refreshExpiresAt) {
    // Ververs access token met refresh token
    const verversd = await verversToken(opgeslagen.refresh);
    nieuw = { ...verversd, refreshExpiresAt: opgeslagen.refreshExpiresAt };
  } else {
    // Volledig nieuw token ophalen
    nieuw = await haalNieuwToken();
  }

  await kv.set("gc:token", nieuw, { px: nieuw.accessExpiresAt - Date.now() + 60_000 });
  return nieuw.access;
}

// ─── Verbinding (requisition) per bedrijf ─────────────────────────────────────

export interface VerbindingStatus {
  requisitionId: string;
  status: "linked" | "pending" | "expired";
  accounts: GcAccount[];
  verbondenOp: string;   // ISO datum
  verlooptOp: string;    // ISO datum (GoCardless: 90 dagen)
}

export async function slaVerbindingOp(
  bedrijf: BedrijfSlug,
  requisitionId: string,
  accounts: GcAccount[]
): Promise<void> {
  const nu = new Date();
  const verloop = new Date(nu.getTime() + 89 * 24 * 60 * 60 * 1000); // 89 dagen
  const status: VerbindingStatus = {
    requisitionId,
    status: "linked",
    accounts,
    verbondenOp: nu.toISOString(),
    verlooptOp: verloop.toISOString(),
  };
  await kv.set(`gc:verbinding:${bedrijf}`, status);
}

export async function haalVerbinding(
  bedrijf: BedrijfSlug
): Promise<VerbindingStatus | null> {
  const status = await kv.get<VerbindingStatus>(`gc:verbinding:${bedrijf}`);
  if (!status) return null;

  // Check verlopen
  if (new Date(status.verlooptOp) < new Date()) {
    return { ...status, status: "expired" };
  }
  return status;
}

export async function verwijderVerbinding(bedrijf: BedrijfSlug): Promise<void> {
  await kv.del(`gc:verbinding:${bedrijf}`);
}

// Sla tijdelijke requisition op tijdens OAuth2 flow
export async function slaPendingRequisitionOp(
  bedrijf: BedrijfSlug,
  requisitionId: string
): Promise<void> {
  await kv.set(`gc:pending:${bedrijf}`, requisitionId, { ex: 3600 }); // 1 uur TTL
}

export async function haalPendingRequisition(
  bedrijf: BedrijfSlug
): Promise<string | null> {
  return kv.get<string>(`gc:pending:${bedrijf}`);
}

// ─── Laatste sync timestamp ────────────────────────────────────────────────────

export async function updateLaatsteSync(bedrijf: BedrijfSlug): Promise<void> {
  await kv.set(`gc:sync:${bedrijf}`, new Date().toISOString());
}

export async function haalLaatsteSync(bedrijf: BedrijfSlug): Promise<string | null> {
  return kv.get<string>(`gc:sync:${bedrijf}`);
}
