/**
 * POST /api/auth/webauthn/auth/complete
 *   body: { sessionId, assertion, vestiging? }
 *   → { ok, rol, naam, vestiging }
 *
 * Verifieert de assertion, looped credential-id naar PIN-eigenaar, en
 * zet de admin-cookie. Vestiging is alleen verplicht voor manager (die
 * kiest een vestiging na succesvolle authenticatie).
 */
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import {
  ADMIN_PIN_PROFIEL,
  verifieerAdminPin,
  zetAdminCookie,
} from "@/lib/admin-auth";
import {
  leesChallenge,
  rpInfo,
  updateCredentialCounter,
  vindCredentialEigenaar,
  wisChallenge,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    assertion?: AuthenticationResponseJSON;
    vestiging?: "bb" | "sl" | "kl";
  };
  if (!body.sessionId || !body.assertion) {
    return NextResponse.json({ error: "sessionId en assertion verplicht" }, { status: 400 });
  }

  const verwachteChallenge = await leesChallenge(body.sessionId);
  if (!verwachteChallenge) {
    return NextResponse.json({ error: "challenge verlopen" }, { status: 400 });
  }

  const credentialId = body.assertion.id;
  const eigenaar = await vindCredentialEigenaar(credentialId);
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
        id: eigenaar.credential.id,
        publicKey: Buffer.from(eigenaar.credential.publicKey, "base64url"),
        counter: eigenaar.credential.counter,
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

  // Counter bijwerken (replay-bescherming — niet kritiek bij iCloud-synced
  // keys want die delen counter niet, maar netjes om te onderhouden).
  await updateCredentialCounter(
    eigenaar.pin,
    eigenaar.credential.id,
    verificatie.authenticationInfo.newCounter,
  );
  await wisChallenge(body.sessionId);

  // Bouw admin-sessie op basis van PIN-profiel
  const profiel = ADMIN_PIN_PROFIEL[eigenaar.pin];
  if (!profiel) {
    return NextResponse.json({ error: "PIN-profiel ontbreekt" }, { status: 500 });
  }
  // Manager moet een vestiging meegeven; owner heeft 'm vast.
  const sessie = verifieerAdminPin(eigenaar.pin, body.vestiging);
  if (!sessie) {
    return NextResponse.json({ error: "kon sessie niet bouwen" }, { status: 500 });
  }
  zetAdminCookie(sessie);

  return NextResponse.json({
    ok: true,
    rol: sessie.rol,
    naam: sessie.naam,
    vestiging: sessie.vestiging,
    pin: eigenaar.pin, // client kan sessionStorage zetten zonder PIN te kennen — hier wel terug
  });
}
