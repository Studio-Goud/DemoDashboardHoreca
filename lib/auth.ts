/**
 * Authenticatie-laag voor medewerkers.
 *
 * - PIN wordt bcrypt-gehashed opgeslagen in medewerkers.pin_hash
 * - Sessies leven in de "sessies" tabel (cookie-token → medewerker_id)
 * - HttpOnly cookie "sg_sessie_token" identificeert de gebruiker
 */
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { db, schema } from "./db/client";

const SESSIE_COOKIE = "sg_sessie_token";
const SESSIE_DUUR_DAGEN = 30;
const REGISTRATIE_DUUR_DAGEN = 14;

export type Rol = "owner" | "manager" | "medewerker";

export interface SessieInfo {
  medewerkerId: number;
  rol: Rol;
  vestiging: string | null;
  naam: string;
  /** True wanneer pin_hash een bulk-geseede default ("1234") is. UI moet dan
   *  naar /m/pin-resetten redirecten tot een eigen PIN is gekozen. */
  moetPinResetten: boolean;
}

// ─── Token helpers ─────────────────────────────────────────────────────────

function genereerToken(): string {
  // 32 bytes → 43 chars base64url, ruim genoeg
  return randomBytes(32).toString("base64url");
}

// ─── PIN hashing ───────────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN moet 4 tot 6 cijfers zijn");
  return bcrypt.hash(pin, 10);
}

export async function checkPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ─── Wachtwoord hashing (account-credential bij zelf-registratie) ─────────

export async function hashWachtwoord(wachtwoord: string): Promise<string> {
  if (wachtwoord.length < 8) throw new Error("Wachtwoord minstens 8 tekens");
  return bcrypt.hash(wachtwoord, 12);
}

export async function checkWachtwoord(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Registratie: code/token genereren + opslaan ──────────────────────────

/**
 * Genereert een 6-cijferige registratiecode (handmatig deelbaar via WhatsApp,
 * SMS, mondeling). Geldig 14 dagen. Combineer met email voor validatie.
 *
 * Botsing 1-op-1M acceptabel binnen kleine medewerkerset. Bij validatie zoeken
 * we op (email + code), dus zelfde code bij twee medewerkers is geen issue.
 */
export async function maakRegistratieCode(medewerkerId: number): Promise<{
  code: string; verloopt: Date;
}> {
  // crypto-secure: 1M-space onmogelijk te raden binnen rate-limit
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const verloopt = new Date();
  verloopt.setDate(verloopt.getDate() + REGISTRATIE_DUUR_DAGEN);
  await db.update(schema.medewerkers).set({
    registratieToken: code,
    registratieVerloopt: verloopt,
    updatedAt: new Date(),
  }).where(eq(schema.medewerkers.id, medewerkerId));
  return { code, verloopt };
}

// Alias voor backwards-compat met email-flow (lange token in URL)
export async function maakRegistratieToken(medewerkerId: number): Promise<{
  token: string; verloopt: Date;
}> {
  const token = genereerToken();
  const verloopt = new Date();
  verloopt.setDate(verloopt.getDate() + REGISTRATIE_DUUR_DAGEN);
  await db.update(schema.medewerkers).set({
    registratieToken: token,
    registratieVerloopt: verloopt,
    updatedAt: new Date(),
  }).where(eq(schema.medewerkers.id, medewerkerId));
  return { token, verloopt };
}

/** Validatie via lange URL-token (email-flow). */
export async function valideerRegistratieToken(token: string): Promise<{
  medewerkerId: number;
  voornaam: string;
  email: string;
} | null> {
  const rows = await db.select({
    id: schema.medewerkers.id,
    voornaam: schema.medewerkers.voornaam,
    email: schema.medewerkers.email,
    verloopt: schema.medewerkers.registratieVerloopt,
  })
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.registratieToken, token),
      eq(schema.medewerkers.actief, true),
    ));
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row.verloopt || row.verloopt < new Date()) return null;
  return { medewerkerId: row.id, voornaam: row.voornaam, email: row.email };
}

/** Validatie via email + 6-cijferige code (handmatige flow). */
export async function valideerRegistratieCodeMetEmail(email: string, code: string): Promise<{
  medewerkerId: number;
  voornaam: string;
  email: string;
} | null> {
  const rows = await db.select({
    id: schema.medewerkers.id,
    voornaam: schema.medewerkers.voornaam,
    email: schema.medewerkers.email,
    verloopt: schema.medewerkers.registratieVerloopt,
  })
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.email, email.toLowerCase().trim()),
      eq(schema.medewerkers.registratieToken, code),
      eq(schema.medewerkers.actief, true),
    ));
  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row.verloopt || row.verloopt < new Date()) return null;
  return { medewerkerId: row.id, voornaam: row.voornaam, email: row.email };
}

export async function voltooidRegistratie(
  medewerkerId: number,
  pin: string,
): Promise<void> {
  const hash = await hashPin(pin);
  await db.update(schema.medewerkers).set({
    pinHash: hash,
    registratieToken: null,
    registratieVerloopt: null,
    updatedAt: new Date(),
  }).where(eq(schema.medewerkers.id, medewerkerId));
}

// ─── Inloggen: maak sessie + cookie ────────────────────────────────────────

/** Maakt sessie + cookie voor een al-geverifieerde medewerker. */
async function maakSessie(
  medewerkerId: number,
  naam: string,
  moetPinResetten: boolean,
): Promise<SessieInfo> {
  const token = genereerToken();
  const verloopt = new Date();
  verloopt.setDate(verloopt.getDate() + SESSIE_DUUR_DAGEN);

  const depts = await db.select({ slug: schema.departments.slug })
    .from(schema.medewerkerDepartments)
    .innerJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
    .where(eq(schema.medewerkerDepartments.medewerkerId, medewerkerId));
  const vestiging = depts[0]?.slug ?? null;

  await db.insert(schema.sessies).values({
    token, medewerkerId, rol: "medewerker", vestiging, verloopt,
  });
  await db.update(schema.medewerkers).set({
    laatsteLogin: new Date(),
  }).where(eq(schema.medewerkers.id, medewerkerId));

  cookies().set(SESSIE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: verloopt,
  });

  return { medewerkerId, rol: "medewerker", vestiging, naam, moetPinResetten };
}

/**
 * Zelf-registratie. Geen email-verificatie (overhead voor MVP); owner kan
 * achteraf reviewen in de admin-tab. Direct ingelogd na succes.
 */
export async function registreerMedewerker(opties: {
  email: string;
  wachtwoord: string;
  voornaam: string;
  achternaam: string;
}): Promise<SessieInfo | { fout: string }> {
  const email = opties.email.toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { fout: "ongeldig email-adres" };

  const bestaand = await db.select({ id: schema.medewerkers.id })
    .from(schema.medewerkers)
    .where(eq(schema.medewerkers.email, email));
  if (bestaand.length > 0) return { fout: "email bestaat al — probeer in te loggen" };

  let hash: string;
  try {
    hash = await hashWachtwoord(opties.wachtwoord);
  } catch (e) {
    return { fout: e instanceof Error ? e.message : "wachtwoord ongeldig" };
  }

  const [m] = await db.insert(schema.medewerkers).values({
    email,
    voornaam: opties.voornaam.trim(),
    achternaam: opties.achternaam.trim(),
    wachtwoordHash: hash,
    actief: true,
  }).returning({ id: schema.medewerkers.id });

  return maakSessie(m.id, `${opties.voornaam} ${opties.achternaam}`.trim(), false);
}

/** Wachtwoord-login (fallback voor wanneer PIN vergeten is). */
export async function inloggenViaWachtwoord(email: string, wachtwoord: string): Promise<SessieInfo | null> {
  const rows = await db.select()
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.email, email.toLowerCase().trim()),
      eq(schema.medewerkers.actief, true),
    ));
  if (rows.length === 0) return null;
  const m = rows[0];
  if (!m.wachtwoordHash) return null;
  const ok = await checkWachtwoord(wachtwoord, m.wachtwoordHash);
  if (!ok) return null;
  return maakSessie(m.id, `${m.voornaam} ${m.achternaam}`.trim(), m.moetPinResetten);
}

/** Zet/wijzig de PIN van een ingelogde medewerker. Wist de moet_pin_resetten
 *  vlag — wie hier komt heeft per definitie een eigen PIN gekozen. */
export async function zetMedewerkerPin(medewerkerId: number, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await db.update(schema.medewerkers).set({
    pinHash: hash,
    moetPinResetten: false,
    updatedAt: new Date(),
  }).where(eq(schema.medewerkers.id, medewerkerId));
}

export async function inloggenMedewerker(email: string, pin: string): Promise<SessieInfo | null> {
  const rows = await db.select()
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.email, email.toLowerCase().trim()),
      eq(schema.medewerkers.actief, true),
    ));
  if (rows.length === 0) return null;
  const m = rows[0];
  if (!m.pinHash) return null;
  const ok = await checkPin(pin, m.pinHash);
  if (!ok) return null;
  return maakSessie(m.id, `${m.voornaam} ${m.achternaam}`.trim(), m.moetPinResetten);
}

/** Login via een geverifieerde passkey (WebAuthn-flow). De caller heeft
 *  signature al gecheckt; deze functie maakt enkel de sessie. */
export async function inloggenMedewerkerViaPasskey(medewerkerId: number): Promise<SessieInfo | null> {
  const rows = await db.select()
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.id, medewerkerId),
      eq(schema.medewerkers.actief, true),
    ));
  if (rows.length === 0) return null;
  const m = rows[0];
  return maakSessie(m.id, `${m.voornaam} ${m.achternaam}`.trim(), m.moetPinResetten);
}

// ─── Sessie lezen (op elke server request) ────────────────────────────────

export async function huidigeSessie(): Promise<SessieInfo | null> {
  const token = cookies().get(SESSIE_COOKIE)?.value;
  if (!token) return null;

  // Filter ook op medewerkers.actief = true: zonder dit kan een ontslagen
  // medewerker met een nog-geldig sessie-cookie (TTL 30 dagen) z'n profiel,
  // BSN, foto's en uren-data blijven opvragen tot het token verloopt.
  const rows = await db.select({
    sessie: schema.sessies,
    medewerker: schema.medewerkers,
  })
    .from(schema.sessies)
    .innerJoin(schema.medewerkers, eq(schema.sessies.medewerkerId, schema.medewerkers.id))
    .where(and(
      eq(schema.sessies.token, token),
      gt(schema.sessies.verloopt, new Date()),
      eq(schema.medewerkers.actief, true),
    ));
  if (rows.length === 0) return null;
  const { sessie, medewerker } = rows[0];
  return {
    medewerkerId: medewerker.id,
    rol: sessie.rol as Rol,
    vestiging: sessie.vestiging,
    naam: `${medewerker.voornaam} ${medewerker.achternaam}`.trim(),
    moetPinResetten: medewerker.moetPinResetten,
  };
}

export async function uitloggen(): Promise<void> {
  const token = cookies().get(SESSIE_COOKIE)?.value;
  if (token) {
    await db.delete(schema.sessies).where(eq(schema.sessies.token, token));
  }
  cookies().delete(SESSIE_COOKIE);
}
