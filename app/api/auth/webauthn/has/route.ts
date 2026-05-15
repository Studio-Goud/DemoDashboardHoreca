/**
 * GET /api/auth/webauthn/has?rol=owner
 *   → { aantal: number, devices: Array<{deviceLabel, aangemaakt}> }
 *
 * Checkt of er voor de gegeven rol passkeys geregistreerd zijn.
 * Wordt door PinGate gebruikt om te beslissen of de "Gebruik Face ID"
 * knop getoond moet worden.
 *
 * Owner-only voor de details (deviceLabel zichtbaar maakt subtiele
 * device-informatie inzichtelijk). Voor de count + heeft-passkey check
 * is geen sessie nodig.
 */
import { NextResponse } from "next/server";
import { credentialsVoorRol } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rol = url.searchParams.get("rol");
  if (rol !== "owner" && rol !== "manager") {
    return NextResponse.json({ error: "rol ongeldig" }, { status: 400 });
  }
  const creds = await credentialsVoorRol(rol);
  console.log(`[webauthn/has] rol=${rol} aantal=${creds.length} ids=${creds.map(c => c.id.slice(0, 8)).join(",")}`);
  return NextResponse.json({
    aantal: creds.length,
    devices: creds.map((c) => ({
      deviceLabel: c.deviceLabel,
      aangemaakt: c.aangemaakt,
    })),
  });
}
