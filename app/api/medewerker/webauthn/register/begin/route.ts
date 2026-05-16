/**
 * POST /api/medewerker/webauthn/register/begin
 *   → { options, sessionId }
 *
 * Genereert WebAuthn registration options voor de ingelogde medewerker.
 * Vereist medewerker-sessie (cookie sg_sessie_token). Het sessionId moet
 * terug naar /register/complete voor verificatie van de attestation.
 */
import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { huidigeSessie } from "@/lib/auth";
import {
  bewaarChallenge,
  laadPasskeys,
  nieuweSessionId,
  rpInfo,
} from "@/lib/medewerker-webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }

  const { rpID, rpName } = rpInfo(req);
  const bestaande = await laadPasskeys(sessie.medewerkerId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: sessie.naam,
    userDisplayName: sessie.naam,
    userID: new TextEncoder().encode(`mw-${sessie.medewerkerId}`),
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: bestaande.map((c) => ({
      id: c.credentialId,
      transports: ["internal"],
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  const sessionId = nieuweSessionId();
  await bewaarChallenge(sessionId, options.challenge);

  return NextResponse.json({ options, sessionId });
}
