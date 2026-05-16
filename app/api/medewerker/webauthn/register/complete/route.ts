/**
 * POST /api/medewerker/webauthn/register/complete
 *   body: { sessionId, attestation, deviceLabel? }
 *   → { ok: true }
 *
 * Verifieert de attestation en slaat de credential op in
 * `medewerker_passkeys`. Met een geldige sessie kan elke medewerker zijn
 * eigen apparaat registreren — geen owner-approval nodig.
 */
import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { huidigeSessie } from "@/lib/auth";
import {
  bewaarChallenge,
  bewaarPasskey,
  leesChallenge,
  rpInfo,
  wisChallenge,
} from "@/lib/medewerker-webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    attestation?: RegistrationResponseJSON;
    deviceLabel?: string;
  };
  if (!body.sessionId || !body.attestation) {
    return NextResponse.json({ error: "sessionId en attestation verplicht" }, { status: 400 });
  }

  const verwachteChallenge = await leesChallenge(body.sessionId);
  if (!verwachteChallenge) {
    return NextResponse.json({ error: "challenge verlopen" }, { status: 400 });
  }

  const { rpID, origin } = rpInfo(req);
  let verificatie;
  try {
    verificatie = await verifyRegistrationResponse({
      response: body.attestation,
      expectedChallenge: verwachteChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verificatie mislukt", detail: e instanceof Error ? e.message : "onbekend" },
      { status: 400 },
    );
  }

  if (!verificatie.verified || !verificatie.registrationInfo) {
    return NextResponse.json({ error: "niet geverifieerd" }, { status: 400 });
  }

  const { credential } = verificatie.registrationInfo;
  await bewaarPasskey({
    medewerkerId: sessie.medewerkerId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    deviceLabel: body.deviceLabel?.trim() || `${sessie.naam}'s apparaat`,
  });

  await wisChallenge(body.sessionId);
  await bewaarChallenge(body.sessionId, "x");

  return NextResponse.json({ ok: true });
}
