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
import { randomBytes } from "crypto";
import { db, schema } from "./db/client";

const SESSIE_COOKIE = "sg_sessie_token";
const SESSIE_DUUR_DAGEN = 30;
const REGISTRATIE_DUUR_DAGEN = 7;

export type Rol = "owner" | "manager" | "medewerker";

export interface SessieInfo {
  medewerkerId: number;
  rol: Rol;
  vestiging: string | null;
  naam: string;
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

// ─── Uitnodiging: token genereren + opslaan ───────────────────────────────

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

  // Sessie aanmaken
  const token = genereerToken();
  const verloopt = new Date();
  verloopt.setDate(verloopt.getDate() + SESSIE_DUUR_DAGEN);

  // Bepaal vestiging (eerste gekoppelde department)
  const depts = await db.select({ slug: schema.departments.slug })
    .from(schema.medewerkerDepartments)
    .innerJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
    .where(eq(schema.medewerkerDepartments.medewerkerId, m.id));
  const vestiging = depts[0]?.slug ?? null;

  await db.insert(schema.sessies).values({
    token, medewerkerId: m.id, rol: "medewerker", vestiging, verloopt,
  });

  await db.update(schema.medewerkers).set({
    laatsteLogin: new Date(),
  }).where(eq(schema.medewerkers.id, m.id));

  // Cookie zetten
  cookies().set(SESSIE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: verloopt,
  });

  return {
    medewerkerId: m.id,
    rol: "medewerker",
    vestiging,
    naam: `${m.voornaam} ${m.achternaam}`.trim(),
  };
}

// ─── Sessie lezen (op elke server request) ────────────────────────────────

export async function huidigeSessie(): Promise<SessieInfo | null> {
  const token = cookies().get(SESSIE_COOKIE)?.value;
  if (!token) return null;

  const rows = await db.select({
    sessie: schema.sessies,
    medewerker: schema.medewerkers,
  })
    .from(schema.sessies)
    .innerJoin(schema.medewerkers, eq(schema.sessies.medewerkerId, schema.medewerkers.id))
    .where(and(
      eq(schema.sessies.token, token),
      gt(schema.sessies.verloopt, new Date()),
    ));
  if (rows.length === 0) return null;
  const { sessie, medewerker } = rows[0];
  return {
    medewerkerId: medewerker.id,
    rol: sessie.rol as Rol,
    vestiging: sessie.vestiging,
    naam: `${medewerker.voornaam} ${medewerker.achternaam}`.trim(),
  };
}

export async function uitloggen(): Promise<void> {
  const token = cookies().get(SESSIE_COOKIE)?.value;
  if (token) {
    await db.delete(schema.sessies).where(eq(schema.sessies.token, token));
  }
  cookies().delete(SESSIE_COOKIE);
}
