/**
 * Roterende QR-token per medewerker. Token-vorm:
 *   {medewerkerId}-{YYYYMMDD}-{hmac16hex}
 *
 * Server kent secret (REVIEW_QR_SECRET of fallback admin secret) en kan
 * dus elke token verifiëren zonder DB-lookup. Token verloopt na 1 dag —
 * scan op dag X+1 wordt geweigerd. Geen replay binnen 24h (datum-check).
 */
import { createHmac, timingSafeEqual } from "crypto";

function geheim(): string {
  const v = process.env.REVIEW_QR_SECRET ?? process.env.ADMIN_COOKIE_SECRET ?? "";
  if (v.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REVIEW_QR_SECRET ontbreekt — zet 'm in Vercel env vars (min 16 tekens).");
    }
    return "DEV-INSECURE-SECRET-zet-REVIEW_QR_SECRET-in-vercel";
  }
  return v;
}

function isoNaarCompact(iso: string): string {
  return iso.replace(/-/g, "");
}

function compactNaarIso(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function hmac(payload: string): string {
  return createHmac("sha256", geheim()).update(payload).digest("hex").slice(0, 16);
}

/** Genereer token voor (medewerkerId, datum). Datum als YYYY-MM-DD. */
export function maakReviewToken(medewerkerId: number, datumIso: string): string {
  const compact = isoNaarCompact(datumIso);
  const payload = `${medewerkerId}.${compact}`;
  return `${medewerkerId}-${compact}-${hmac(payload)}`;
}

export interface VerifieerdeToken {
  medewerkerId: number;
  datum: string; // YYYY-MM-DD
}

/**
 * Verifieer een token. Returnt null bij ongeldig (verkeerde HMAC of
 * datum buiten venster van ±1 dag tov vandaag — staat replay van
 * gisteren toe voor avond-shifts, niet verder).
 */
export function verifieerReviewToken(token: string, nu: Date = new Date()): VerifieerdeToken | null {
  const m = /^(\d+)-(\d{8})-([0-9a-f]{16})$/.exec(token);
  if (!m) return null;
  const medewerkerId = parseInt(m[1], 10);
  const compactDatum = m[2];
  const gegevenHmac = m[3];

  const verwacht = hmac(`${medewerkerId}.${compactDatum}`);
  const a = Buffer.from(gegevenHmac, "hex");
  const b = Buffer.from(verwacht, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const datum = compactNaarIso(compactDatum);
  const datumDate = new Date(datum + "T12:00:00");
  const verschilDagen = Math.abs(nu.getTime() - datumDate.getTime()) / 86400000;
  if (verschilDagen > 1.5) return null;

  return { medewerkerId, datum };
}

/** YYYY-MM-DD voor "vandaag" in Europe/Amsterdam. */
export function vandaagIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}
