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
import { createHmac, timingSafeEqual } from "node:crypto";

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
 * Server-secret voor cookie-signing. In productie VERPLICHT — als de env
 * var ontbreekt gooien we, anders zou een misgrijp in Vercel-config een
 * forgeable HMAC opleveren waarmee elke bezoeker een owner-cookie kan
 * minten.
 *
 * In dev mag een deterministic dummy om lokaal werken niet stuk te maken.
 */
function getSecret(): string {
  const env = process.env.ADMIN_COOKIE_SECRET;
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_COOKIE_SECRET ontbreekt of te kort in productie — zet 'm in Vercel env vars (min 16 tekens).",
    );
  }
  return "DEV-INSECURE-SECRET-zet-ADMIN_COOKIE_SECRET-in-vercel";
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
  // Timing-safe compare: anders kan een aanvaller via response-time
  // leren waar een geforced signature mis-matched. Buffers moeten zelfde
  // lengte hebben — verwerp anders direct.
  const verwacht = Buffer.from(ondertekenen(body), "utf8");
  const ontvangen = Buffer.from(sig, "utf8");
  if (verwacht.length !== ontvangen.length) return null;
  if (!timingSafeEqual(verwacht, ontvangen)) return null;
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
 *
 * `gewensteRol` is een optionele "view-as" parameter — owners mogen
 * ook als manager inloggen om de manager-UI te testen. In dat geval
 * krijgt de sessie rol="manager" maar blijft de naam de owner-naam met
 * "(eigenaar)" suffix zodat audit-logs traceerbaar blijven.
 */
export function verifieerAdminPin(
  pin: string,
  vestiging?: "bb" | "sl" | "kl",
  gewensteRol?: "owner" | "manager",
): AdminSessie | null {
  const profiel = ADMIN_PIN_PROFIEL[pin];
  if (!profiel) return null;

  // Standaard: rol uit profiel. Manager-PIN's mogen NOOIT als owner inloggen.
  let effectieveRol: "owner" | "manager" = profiel.rol;
  let naam = profiel.naam;

  if (gewensteRol && gewensteRol !== profiel.rol) {
    if (profiel.rol === "owner" && gewensteRol === "manager") {
      // Owner test de manager-view — toegestaan, met audit-suffix.
      effectieveRol = "manager";
      naam = `${profiel.naam} (eigenaar)`;
    } else {
      // Manager-PIN voor owner-knop → geweigerd.
      return null;
    }
  }

  return {
    rol: effectieveRol,
    naam,
    vestiging: profiel.rol === "owner" && effectieveRol === "owner"
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
