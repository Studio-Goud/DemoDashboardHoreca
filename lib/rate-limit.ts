/**
 * Eenvoudige KV-backed rate-limiter voor login-routes en andere
 * brute-force-gevoelige endpoints.
 *
 * Werkt op een fixed-window per <sleutel>: bij elke registreerPoging()
 * incrementeren we een teller, en als 'ie boven de drempel komt is
 * `geblokkeerd: true` met `restSec` als wachttijd. TTL = window-grootte;
 * KV verwijdert de teller automatisch na afloop.
 *
 * Niet bedoeld voor strikte distributed rate-limiting — geen lock op
 * INCR. Goed genoeg om een single attacker af te remmen.
 */
import { kv } from "@vercel/kv";

export interface RateLimitResultaat {
  geblokkeerd: boolean;
  pogingen: number;
  restSec: number; // tijd tot teller reset
}

const PREFIX = "rate:";

function kvBeschikbaar(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Registreer een poging op `sleutel` (bv. "login:1.2.3.4"). Returnt of
 * de aanroeper geblokkeerd moet worden.
 *
 * @param max     Max pogingen binnen het venster (bv. 5)
 * @param venster Window-grootte in seconden (bv. 900 = 15 min)
 */
export async function registreerPoging(
  sleutel: string,
  max: number,
  venster: number,
): Promise<RateLimitResultaat> {
  if (!kvBeschikbaar()) {
    // Geen KV → kunnen niet rate-limiten. Sta toe (preferred boven hard-fail
    // in dev). In prod is KV wel beschikbaar.
    return { geblokkeerd: false, pogingen: 0, restSec: 0 };
  }
  const key = PREFIX + sleutel;
  try {
    const pogingen = await kv.incr(key);
    if (pogingen === 1) {
      // Eerste poging in dit window — zet TTL
      await kv.expire(key, venster);
    }
    const restSec = await kv.ttl(key);
    return {
      geblokkeerd: pogingen > max,
      pogingen,
      restSec: typeof restSec === "number" && restSec > 0 ? restSec : venster,
    };
  } catch {
    // KV-fout — degraded mode: laat door
    return { geblokkeerd: false, pogingen: 0, restSec: 0 };
  }
}

/**
 * Reset de teller (bv. na succesvolle login zodat één geslaagde poging
 * de geschiedenis schoonveegt).
 */
export async function resetPoging(sleutel: string): Promise<void> {
  if (!kvBeschikbaar()) return;
  try {
    await kv.del(PREFIX + sleutel);
  } catch { /* stil */ }
}

/**
 * Haal IP uit het request — Vercel zet x-forwarded-for, anders cf-
 * connecting-ip of de remote socket-host (in dev "unknown").
 */
export function ipUitRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}
