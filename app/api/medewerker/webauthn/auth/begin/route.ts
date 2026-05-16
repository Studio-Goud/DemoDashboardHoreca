/**
 * POST /api/medewerker/webauthn/auth/begin
 *   → { options, sessionId }
 *
 * Start van een passkey-login op /m/login. We sturen de hele allowList van
 * medewerker-credentials mee zodat iOS / Android een picker kan tonen; na
 * succesvolle assertion looped /auth/complete de credential-id terug naar
 * de juiste medewerker.
 */
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import {
  allePasskeys,
  bewaarChallenge,
  nieuweSessionId,
  rpInfo,
} from "@/lib/medewerker-webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const credentials = await allePasskeys();
  if (credentials.length === 0) {
    return NextResponse.json(
      { error: "geen passkeys geregistreerd" },
      { status: 404 },
    );
  }

  const { rpID } = rpInfo(req);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: ["internal"],
    })),
  });

  const sessionId = nieuweSessionId();
  await bewaarChallenge(sessionId, options.challenge);

  return NextResponse.json({ options, sessionId });
}
