/**
 * POST /api/auth/webauthn/auth/begin
 *   body: { rol: "owner" | "manager" }
 *   → { options, sessionId }
 *
 * Geen sessie nodig — dit is de start van een login. Server bouwt
 * allowCredentials lijst uit alle registreerde credentials voor de
 * gevraagde rol; iOS toont vervolgens Face ID prompt om er één te kiezen.
 */
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import {
  bewaarChallenge,
  credentialsVoorRol,
  nieuweSessionId,
  rpInfo,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { rol?: "owner" | "manager" };
  if (body.rol !== "owner" && body.rol !== "manager") {
    return NextResponse.json({ error: "rol ongeldig" }, { status: 400 });
  }

  const credentials = await credentialsVoorRol(body.rol);
  if (credentials.length === 0) {
    // Geen passkeys → client moet PIN-flow gebruiken.
    return NextResponse.json({ error: "geen passkeys voor deze rol" }, { status: 404 });
  }

  const { rpID } = rpInfo(req);
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      transports: ["internal"],
    })),
  });

  const sessionId = nieuweSessionId();
  await bewaarChallenge(sessionId, options.challenge);

  return NextResponse.json({ options, sessionId });
}
