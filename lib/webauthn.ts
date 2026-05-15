/**
 * WebAuthn helpers voor passkey-login (Face ID / Touch ID / Windows Hello).
 *
 * Credentials worden per PIN opgeslagen in Vercel KV. PIN blijft de
 * "user identity" — een passkey is gewoon een sneller alternatief
 * voor PIN-invoer. PIN-fallback blijft altijd beschikbaar.
 *
 * Storage:
 *   webauthn:cred:<pin>        → OpgeslagenCredential[]
 *   webauthn:challenge:<sid>   → string (TTL 5 min)
 */
import { kv } from "@vercel/kv";
import { randomBytes } from "node:crypto";
import { ADMIN_PIN_PROFIEL } from "./admin-auth";
import { metLock } from "./kv-lock";

const KV_CRED_PREFIX = "webauthn:cred:";
const KV_CHALLENGE_PREFIX = "webauthn:challenge:";
const CHALLENGE_TTL_SEC = 300;

export interface OpgeslagenCredential {
  /** base64url-encoded credential id (van de browser). */
  id: string;
  /** base64url-encoded public key (cose). */
  publicKey: string;
  /** Signature counter — wordt na elke succesvolle login verhoogd. */
  counter: number;
  /** Welke PIN/identiteit deze credential vertegenwoordigt. */
  pin: string;
  /** Vrij label dat de owner kiest ("iPhone Ricardo"). */
  deviceLabel: string;
  /** ISO datestamp van aanmaak. */
  aangemaakt: string;
}

export async function laadCredentials(pin: string): Promise<OpgeslagenCredential[]> {
  const data = await kv.get<OpgeslagenCredential[]>(KV_CRED_PREFIX + pin);
  return data ?? [];
}

export async function bewaarCredential(cred: OpgeslagenCredential): Promise<void> {
  await metLock(KV_CRED_PREFIX + cred.pin, async () => {
    const lijst = await laadCredentials(cred.pin);
    const nieuw = [...lijst.filter((c) => c.id !== cred.id), cred];
    await kv.set(KV_CRED_PREFIX + cred.pin, nieuw);
  });
}

export async function updateCredentialCounter(
  pin: string,
  credentialId: string,
  nieuweCounter: number,
): Promise<void> {
  await metLock(KV_CRED_PREFIX + pin, async () => {
    const lijst = await laadCredentials(pin);
    const i = lijst.findIndex((c) => c.id === credentialId);
    if (i === -1) return;
    lijst[i].counter = nieuweCounter;
    await kv.set(KV_CRED_PREFIX + pin, lijst);
  });
}

export async function verwijderCredential(pin: string, credentialId: string): Promise<void> {
  await metLock(KV_CRED_PREFIX + pin, async () => {
    const lijst = await laadCredentials(pin);
    await kv.set(KV_CRED_PREFIX + pin, lijst.filter((c) => c.id !== credentialId));
  });
}

/** Alle credentials over alle PINs binnen één rol (owner of manager). */
export async function credentialsVoorRol(
  rol: "owner" | "manager",
): Promise<OpgeslagenCredential[]> {
  const matchPins = Object.entries(ADMIN_PIN_PROFIEL)
    .filter(([, p]) => p.rol === rol)
    .map(([pin]) => pin);
  const alles: OpgeslagenCredential[] = [];
  for (const pin of matchPins) {
    alles.push(...(await laadCredentials(pin)));
  }
  return alles;
}

/** Zoek welke PIN bij een gegeven credential-id hoort (na authn). */
export async function vindCredentialEigenaar(
  credentialId: string,
): Promise<{ pin: string; credential: OpgeslagenCredential } | null> {
  for (const pin of Object.keys(ADMIN_PIN_PROFIEL)) {
    const lijst = await laadCredentials(pin);
    const match = lijst.find((c) => c.id === credentialId);
    if (match) return { pin, credential: match };
  }
  return null;
}

// ─── Challenge management (KV met TTL) ────────────────────────────────────────

export function nieuweSessionId(): string {
  return randomBytes(18).toString("base64url");
}

export async function bewaarChallenge(sessionId: string, challenge: string): Promise<void> {
  await kv.set(KV_CHALLENGE_PREFIX + sessionId, challenge, { ex: CHALLENGE_TTL_SEC });
}

export async function leesChallenge(sessionId: string): Promise<string | null> {
  return (await kv.get<string>(KV_CHALLENGE_PREFIX + sessionId)) ?? null;
}

export async function wisChallenge(sessionId: string): Promise<void> {
  await kv.del(KV_CHALLENGE_PREFIX + sessionId);
}

// ─── Relying Party info ──────────────────────────────────────────────────────

/**
 * RP-ID is de eTLD+1 van de host waar de app draait. Voor productie zet
 * je WEBAUTHN_RP_ID in Vercel env (bv. "omzet.studio-goud.nl"); in dev
 * pakken we automatisch de hostname uit het request.
 *
 * Origin: WEBAUTHN_ORIGIN of url.origin. iOS verwacht dat dit exact
 * match met de origin in de browser; bij mismatch faalt verificatie.
 */
export function rpInfo(req: Request): { rpID: string; origin: string; rpName: string } {
  const url = new URL(req.url);
  return {
    rpID: process.env.WEBAUTHN_RP_ID || url.hostname,
    origin: process.env.WEBAUTHN_ORIGIN || url.origin,
    rpName: process.env.WEBAUTHN_RP_NAME || "Markthal HQ",
  };
}
