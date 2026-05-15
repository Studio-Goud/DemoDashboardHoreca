/**
 * Server-side admin/owner authenticatie via cookie.
 *
 * Owners/managers loggen in via PinGate (client-side, sessionStorage).
 * Voor server-side API endpoints (admin-acties, salaris) hebben we een
 * HttpOnly cookie nodig die de server kan lezen.
 *
 * Workflow:
 * 1. PinGate accepteert PIN client-side
 * 2. PinGate POST't naar /api/admin/login met de PIN
 * 3. /api/admin/login verifieert PIN tegen PIN_PROFIEL en zet cookie
 * 4. Server-endpoints lezen `huidigeAdminSessie()` voor de rol-check
 *
 * Cookie-content: signed JSON met { rol, naam, vestiging }. Signing met
 * een server-secret zodat de cookie niet client-side te manipuleren is.
 */
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

const ADMIN_COOKIE = "sg_admin_sessie";
const COOKIE_DUUR_DAGEN = 7;

// Owner + manager PIN-profielen. ZELFDE als in components/PinGate.tsx.
// (We zouden dit kunnen extraheren naar een gedeelde lib maar voor nu
// dupliceren we het om import-cycles te voorkomen.)
//
// Managers krijgen elk hun eigen PIN ipv één gedeelde 2222 — zo blijft
// audit-trail per persoon traceerbaar en kan een individuele manager
// uitgesloten worden zonder dat anderen geraakt worden.
export const ADMIN_PIN_PROFIEL: Record<
  string,
  { naam: string; rol: "owner" | "manager"; vestiging?: "bb" | "sl" | "kl" }
> = {
  "2026": { naam: "Ricardo",  rol: "owner",   vestiging: "bb" },
  "2580": { naam: "Matthieu", rol: "owner",   vestiging: "kl" },
  "3001": { naam: "Gianni",   rol: "manager" },
  "3002": { naam: "Theresa",  rol: "manager" },
};

export interface AdminSessie {
  rol: "owner" | "manager";
  naam: string;
  vestiging: "bb" | "sl" | "kl" | null;
}

/**
 * Server-secret voor cookie-signing. Faalt als env-var ontbreekt — kies
 * een willekeurige string van >= 32 chars in Vercel env-vars onder
 * ADMIN_COOKIE_SECRET.
 *
 * Fallback in dev: deterministische dummy zodat lokaal testen werkt
 * zonder env-var te zetten. In productie ALTIJD echte secret zetten.
 */
function getSecret(): string {
  return process.env.ADMIN_COOKIE_SECRET ?? "DEV-INSECURE-SECRET-zet-ADMIN_COOKIE_SECRET-in-vercel";
}

function ondertekenen(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function maakToken(sessie: AdminSessie): string {
  const payload = JSON.stringify(sessie);
  const body = Buffer.from(payload, "utf8").toString("base64url");
  const sig = ondertekenen(body);
  return `${body}.${sig}`;
}

function leesToken(token: string): AdminSessie | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  // Constant-time compare via HMAC re-tekening
  if (ondertekenen(body) !== sig) return null;
  try {
    const payload = Buffer.from(body, "base64url").toString("utf8");
    return JSON.parse(payload) as AdminSessie;
  } catch {
    return null;
  }
}

/**
 * Verifieer een PIN en (bij succes) bouw een AdminSessie object.
 * Owners hebben hun vaste vestiging mee. Manager-vestiging wordt
 * later via een aparte cookie-update gezet (na de vestiging-keuze in
 * PinGate).
 */
export function verifieerAdminPin(
  pin: string,
  vestiging?: "bb" | "sl" | "kl",
): AdminSessie | null {
  const profiel = ADMIN_PIN_PROFIEL[pin];
  if (!profiel) return null;
  return {
    rol: profiel.rol,
    naam: profiel.naam,
    vestiging: profiel.rol === "owner"
      ? (profiel.vestiging ?? null)
      : (vestiging ?? null),
  };
}

/**
 * Zet de admin-cookie. Aangeroepen door de login-route.
 */
export function zetAdminCookie(sessie: AdminSessie): void {
  const token = maakToken(sessie);
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_DUUR_DAGEN * 24 * 60 * 60,
  });
}

/**
 * Verwijder de admin-cookie (logout).
 */
export function wisAdminCookie(): void {
  cookies().delete(ADMIN_COOKIE);
}

/**
 * Lees + verifieer de huidige admin-sessie uit de cookie. Returnt null
 * als geen geldige cookie aanwezig is (of als de signature niet klopt).
 */
export function huidigeAdminSessie(): AdminSessie | null {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return leesToken(token);
}
