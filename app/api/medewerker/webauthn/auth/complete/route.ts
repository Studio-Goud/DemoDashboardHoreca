/**
 * POST /api/medewerker/webauthn/auth/complete
 *   body: { sessionId, assertion }
 *   → { ok, naam, vestiging, moetPinResetten }
 *
 * Verifieert de assertion, identificeert de medewerker via credentialId en
 * zet de medewerker-sessie-cookie (sg_sessie_token). Geen PIN nodig.
 */
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { inloggenMedewerkerViaPasskey } from "@/lib/auth";
import {
  leesChallenge,
  rpInfo,
  updateCounter,
  vindEigenaar,
  wisChallenge,
} from "@/lib/medewerker-webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    assertion?: AuthenticationResponseJSON;
  };
  if (!body.sessionId || !body.assertion) {
    return NextResponse.json({ error: "sessionId en assertion verplicht" }, { status: 400 });
  }

  const verwachteChallenge = await leesChallenge(body.sessionId);
  if (!verwachteChallenge) {
    return NextResponse.json({ error: "challenge verlopen" }, { status: 400 });
  }

  const credentialId = body.assertion.id;
  const eigenaar = await vindEigenaar(credentialId);
  if (!eigenaar) {
    return NextResponse.json({ error: "onbekende credential" }, { status: 401 });
  }

  const { rpID, origin } = rpInfo(req);
  let verificatie;
  try {
    verificatie = await verifyAuthenticationResponse({
      response: body.assertion,
      expectedChallenge: verwachteChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: eigenaar.credentialId,
        publicKey: Buffer.from(eigenaar.publicKey, "base64url"),
        counter: eigenaar.counter,
      },
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verificatie mislukt", detail: e instanceof Error ? e.message : "onbekend" },
      { status: 401 },
    );
  }

  if (!verificatie.verified) {
    return NextResponse.json({ error: "niet geverifieerd" }, { status: 401 });
  }

  await updateCounter(eigenaar.credentialId, verificatie.authenticationInfo.newCounter);
  await wisChallenge(body.sessionId);

  const sessie = await inloggenMedewerkerViaPasskey(eigenaar.medewerkerId);
  if (!sessie) {
    return NextResponse.json({ error: "account inactief" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    naam: sessie.naam,
    vestiging: sessie.vestiging,
    moetPinResetten: sessie.moetPinResetten,
  });
}
