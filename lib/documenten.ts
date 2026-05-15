/**
 * AES-256-GCM versleuteling voor BSN + ID/bankpas-foto's.
 *
 * Key staat in env var DOCUMENTEN_ENCRYPTIE_KEY als 64-char hex string
 * (32 bytes). In productie verplicht; in dev valt 'ie terug op een
 * deterministic dummy zodat lokaal werken niet stuk gaat.
 *
 * GCM voegt een 16-byte auth tag toe die we apart bewaren zodat tampering
 * detecteerbaar is. IV (12 bytes) is per-blob random — herbruiken zou GCM
 * volledig breken.
 *
 * Storage-formaat:
 *   - tekst (BSN): we slaan iv+authtag+ciphertext als één string op met ":"-
 *     als scheider (alle hex), zodat 1 kolom volstaat
 *   - foto's: 3 aparte kolommen (iv, authtag, ciphertext base64) zodat
 *     binary efficient blijft
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = process.env.DOCUMENTEN_ENCRYPTIE_KEY;
  if (raw) {
    // Strip whitespace/newlines die soms meekomen bij copy-paste in
    // Vercel env-var UI. Accepteer ook 64-char base64 (44 chars met "="
    // of 43 zonder padding) als alternatief formaat.
    const trimmed = raw.trim().replace(/\s+/g, "");
    if (trimmed.length === KEY_BYTES * 2 && /^[0-9a-fA-F]+$/.test(trimmed)) {
      return Buffer.from(trimmed, "hex");
    }
    if (
      (trimmed.length === 44 || trimmed.length === 43) &&
      /^[A-Za-z0-9+/=_-]+$/.test(trimmed)
    ) {
      const buf = Buffer.from(trimmed.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      if (buf.length === KEY_BYTES) return buf;
    }
    throw new Error(
      `DOCUMENTEN_ENCRYPTIE_KEY ongeldig formaat — verwacht ${KEY_BYTES * 2} hex-chars (32 bytes), ` +
      `kreeg ${trimmed.length} tekens. Genereer met: openssl rand -hex 32`,
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DOCUMENTEN_ENCRYPTIE_KEY ontbreekt in productie");
  }
  // Dev fallback — DETERMINISTIC, mag NOOIT in productie gebruikt worden.
  return Buffer.from("dev-only-key-do-not-use-in-prod-32b".padEnd(KEY_BYTES, "x"), "utf8");
}

// ─── Tekst (BSN) ──────────────────────────────────────────────────────────────

export function versleutelTekst(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function ontsleutelTekst(opgeslagen: string): string {
  const [ivHex, tagHex, ctHex] = opgeslagen.split(":");
  if (!ivHex || !tagHex || !ctHex) {
    throw new Error("ongeldig versleutelde-tekst-formaat");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

// ─── Binary (foto's) ─────────────────────────────────────────────────────────

export interface VersleuteldBestand {
  iv: string;        // hex
  authtag: string;   // hex
  ciphertext: string;// base64 (compacter dan hex)
}

export function versleutelBestand(plain: Buffer): VersleuteldBestand {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    authtag: tag.toString("hex"),
    ciphertext: ct.toString("base64"),
  };
}

export function ontsleutelBestand(b: VersleuteldBestand): Buffer {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(b.iv, "hex"));
  decipher.setAuthTag(Buffer.from(b.authtag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(b.ciphertext, "base64")),
    decipher.final(),
  ]);
}
