/**
 * GET /api/auth/webauthn/has-mine
 *   → { aantal: number, devices: Array<{deviceLabel, aangemaakt}> }
 *
 * Per-user variant van /has. Kijkt op basis van de ingelogde
 * admin-sessie of er passkeys zijn voor deze specifieke gebruiker.
 * Gebruikt door FaceIDPromptModal zodat de modal niet meer terugkomt
 * nadat de huidige owner zijn passkey heeft ingesteld.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie, ADMIN_PIN_PROFIEL } from "@/lib/admin-auth";
import { laadCredentials } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ aantal: 0, devices: [] });

  // Strip "(eigenaar)"-suffix voor owners die in manager-view ingelogd zijn.
  const echteNaam = sessie.naam.replace(/\s*\(eigenaar\)\s*$/i, "");
  const pinEntry = Object.entries(ADMIN_PIN_PROFIEL).find(
    ([, p]) => p.naam === echteNaam,
  );
  if (!pinEntry) return NextResponse.json({ aantal: 0, devices: [] });

  const [pin] = pinEntry;
  const creds = await laadCredentials(pin);
  return NextResponse.json({
    aantal: creds.length,
    devices: creds.map((c) => ({
      deviceLabel: c.deviceLabel,
      aangemaakt: c.aangemaakt,
    })),
  });
}
