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
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { credentialsVoorRol } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rol = url.searchParams.get("rol");
  if (rol !== "owner" && rol !== "manager") {
    return NextResponse.json({ error: "rol ongeldig" }, { status: 400 });
  }
  const creds = await credentialsVoorRol(rol);
  // Devices-detail (label, datum) is alleen voor ingelogde owners zichtbaar
  // — zonder check zou een bezoeker via "iPhone Ricardo" enz. namen van
  // owners-apparaten kunnen scrapen.
  const sessie = huidigeAdminSessie();
  const isOwner = sessie?.rol === "owner";
  return NextResponse.json({
    aantal: creds.length,
    devices: isOwner
      ? creds.map((c) => ({ deviceLabel: c.deviceLabel, aangemaakt: c.aangemaakt }))
      : undefined,
  });
}
