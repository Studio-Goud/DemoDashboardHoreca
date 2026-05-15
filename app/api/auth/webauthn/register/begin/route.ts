/**
 * POST /api/auth/webauthn/register/begin
 *   → { options, sessionId }
 *
 * Genereert WebAuthn registration options voor de ingelogde owner/manager.
 * Vereist admin-cookie (PIN-login). De client geeft sessionId + assertion
 * terug aan /register/complete om de credential te bewaren.
 */
import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { huidigeAdminSessie, ADMIN_PIN_PROFIEL } from "@/lib/admin-auth";
import {
  bewaarChallenge,
  laadCredentials,
  nieuweSessionId,
  rpInfo,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  // Welke PIN hoort bij deze gebruiker? We zoeken via naam (uniek genoeg).
  const pinEntry = Object.entries(ADMIN_PIN_PROFIEL).find(
    ([, p]) => p.naam === sessie.naam && p.rol === sessie.rol,
  );
  if (!pinEntry) {
    return NextResponse.json({ error: "geen PIN-profiel voor sessie" }, { status: 500 });
  }
  const [pin] = pinEntry;

  const { rpID, rpName } = rpInfo(req);
  const bestaande = await laadCredentials(pin);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: sessie.naam,
    userDisplayName: sessie.naam,
    userID: new TextEncoder().encode(pin), // PIN als user-id (intern, niet zichtbaar)
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: bestaande.map((c) => ({
      id: c.id,
      transports: ["internal"],
    })),
    authenticatorSelection: {
      // Platform authenticator = Face ID / Touch ID / Windows Hello (geen USB-keys)
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  const sessionId = nieuweSessionId();
  await bewaarChallenge(sessionId, options.challenge);

  return NextResponse.json({ options, sessionId });
}
