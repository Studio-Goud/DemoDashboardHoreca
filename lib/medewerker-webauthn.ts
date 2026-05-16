/**
 * WebAuthn / passkey-laag voor medewerkers (Face ID / Touch ID / Windows Hello).
 *
 * Parallel aan lib/webauthn.ts (dat is owner/manager-only en gebruikt Vercel
 * KV met admin-PIN als sleutel). Hier slaan we credentials op in Postgres
 * (`medewerker_passkeys`) en koppelen ze aan medewerker_id. Challenges
 * leven kort in KV met TTL — net als bij admin.
 *
 * Eén medewerker kan meerdere apparaten registreren (telefoon, tablet). PIN
 * blijft als fallback altijd beschikbaar — passkey is uitsluitend convenience.
 */
import { kv } from "@vercel/kv";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/client";

const KV_CHALLENGE_PREFIX = "mw-webauthn:challenge:";
const CHALLENGE_TTL_SEC = 300;

export interface MedewerkerPasskey {
  id: number;
  medewerkerId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceLabel: string;
}

export async function laadPasskeys(medewerkerId: number): Promise<MedewerkerPasskey[]> {
  const rows = await db.select()
    .from(schema.medewerkerPasskeys)
    .where(eq(schema.medewerkerPasskeys.medewerkerId, medewerkerId));
  return rows.map((r) => ({
    id: r.id,
    medewerkerId: r.medewerkerId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: r.counter,
    deviceLabel: r.deviceLabel,
  }));
}

export async function bewaarPasskey(input: {
  medewerkerId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceLabel: string;
}): Promise<void> {
  await db.insert(schema.medewerkerPasskeys).values({
    medewerkerId: input.medewerkerId,
    credentialId: input.credentialId,
    publicKey: input.publicKey,
    counter: input.counter,
    deviceLabel: input.deviceLabel,
  });
}

export async function updateCounter(credentialId: string, nieuweCounter: number): Promise<void> {
  await db.update(schema.medewerkerPasskeys)
    .set({ counter: nieuweCounter, laatsteGebruikt: new Date() })
    .where(eq(schema.medewerkerPasskeys.credentialId, credentialId));
}

/** Zoek welke medewerker bij een credential-id hoort (na assertion). */
export async function vindEigenaar(credentialId: string): Promise<MedewerkerPasskey | null> {
  const rows = await db.select()
    .from(schema.medewerkerPasskeys)
    .where(eq(schema.medewerkerPasskeys.credentialId, credentialId));
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    medewerkerId: r.medewerkerId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: r.counter,
    deviceLabel: r.deviceLabel,
  };
}

/** Alle credentials van álle medewerkers — voor de loginpagina-allowList. */
export async function allePasskeys(): Promise<MedewerkerPasskey[]> {
  const rows = await db.select().from(schema.medewerkerPasskeys);
  return rows.map((r) => ({
    id: r.id,
    medewerkerId: r.medewerkerId,
    credentialId: r.credentialId,
    publicKey: r.publicKey,
    counter: r.counter,
    deviceLabel: r.deviceLabel,
  }));
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

// ─── Relying Party info (re-use admin-config) ────────────────────────────────

export function rpInfo(req: Request): { rpID: string; origin: string; rpName: string } {
  const url = new URL(req.url);
  return {
    rpID: process.env.WEBAUTHN_RP_ID || url.hostname,
    origin: process.env.WEBAUTHN_ORIGIN || url.origin,
    rpName: process.env.WEBAUTHN_RP_NAME || "Markthal HQ",
  };
}
