/**
 * Per-key advisory lock voor KV read-modify-write paden.
 *
 * Probleem: lib/boekhouding-kv.ts (slaIngOp, voegContantToe, updateFactuur,
 * etc.) en lib/webauthn.ts (bewaarCredential) doen RMW op een KV-blob
 * zonder atomic compare-and-swap. Twee gelijktijdige uploads → laatste-
 * wint, één blob wordt verloren.
 *
 * Oplossing: vóór de RMW een lock-key zetten met `nx: true` (SETNX) + TTL,
 * en de bewerking pas uitvoeren als de lock gewonnen is. Bij conflict
 * retry'en met exponentiële backoff. Bij timeout returnt de helper een
 * exception zodat de caller een 409 of 503 kan teruggeven.
 *
 * Niet bedoeld als full distributed lock — geen fencing tokens. Goed
 * genoeg om "twee gelijktijdige owner-clicks" te ontknopen.
 */
import { kv } from "@vercel/kv";

const LOCK_PREFIX = "lock:";
const DEFAULT_TTL_SEC = 10;       // hoe lang we de lock vasthouden
const DEFAULT_TRIES = 25;          // ~25 × ~120ms = 3 sec max wait
const POLL_BASIS_MS = 60;

function kvBeschikbaar(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function slaap(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Voer `fn` uit met exclusieve toegang tot `sleutel`. Returnt het
 * resultaat van fn. Throwt als lock niet binnen `tries × interval` te
 * pakken is.
 */
export async function metLock<T>(
  sleutel: string,
  fn: () => Promise<T>,
  opties: { ttlSec?: number; tries?: number } = {},
): Promise<T> {
  if (!kvBeschikbaar()) {
    // Geen KV → degraded mode, geen lock mogelijk. Voer toch uit (caller
    // moet zelf weten dat hij in dev draait).
    return fn();
  }
  const ttl = opties.ttlSec ?? DEFAULT_TTL_SEC;
  const tries = opties.tries ?? DEFAULT_TRIES;
  const lockKey = LOCK_PREFIX + sleutel;

  for (let i = 0; i < tries; i++) {
    // SETNX met TTL: alleen gezet als er nog geen lock bestaat
    const gezet = await kv.set(lockKey, "1", { nx: true, ex: ttl });
    if (gezet === "OK") {
      try {
        return await fn();
      } finally {
        try { await kv.del(lockKey); } catch { /* stil */ }
      }
    }
    // Lock bezet — wacht met lichte jitter (voorkomt thundering herd)
    await slaap(POLL_BASIS_MS + Math.random() * 60);
  }
  throw new Error(`KV-lock op "${sleutel}" niet verkregen na ${tries} pogingen`);
}
