/**
 * POST /api/auth/webauthn/register/complete
 *   body: { sessionId, attestation, deviceLabel? }
 *   → { ok: true }
 *
 * Verifieert de attestation tegen de challenge uit /register/begin en
 * slaat de nieuwe credential op in KV onder de PIN van de owner.
 */
import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { huidigeAdminSessie, ADMIN_PIN_PROFIEL } from "@/lib/admin-auth";
import {
  bewaarChallenge,
  bewaarCredential,
  leesChallenge,
  rpInfo,
  wisChallenge,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const pinEntry = Object.entries(ADMIN_PIN_PROFIEL).find(
    ([, p]) => p.naam === sessie.naam && p.rol === sessie.rol,
  );
  if (!pinEntry) return NextResponse.json({ error: "geen PIN" }, { status: 500 });
  const [pin] = pinEntry;

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
  await bewaarCredential({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    pin,
    deviceLabel: body.deviceLabel?.trim() || `${sessie.naam}'s apparaat`,
    aangemaakt: new Date().toISOString(),
  });
  console.log(`[webauthn/register] opgeslagen voor pin=${pin} (${sessie.naam}) id=${credential.id.slice(0, 8)}…`);

  await wisChallenge(body.sessionId);
  // Onbruikbaar maken door overschrijven met willekeurige waarde — extra
  // bescherming naast TTL voor het geval KV de del-call mist.
  await bewaarChallenge(body.sessionId, "x");

  return NextResponse.json({ ok: true });
}
