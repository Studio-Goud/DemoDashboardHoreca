/**
 * GET /api/medewerker/webauthn/has-mine
 *   → { aantal: number, devices: Array<{ deviceLabel, aangemaakt }> }
 *
 * Vertelt de FaceID-prompt of deze medewerker al een passkey heeft op zijn
 * account; zo ja dan toont 'm zichzelf niet meer.
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ aantal: 0, devices: [] });
  }
  const rows = await db
    .select({
      deviceLabel: schema.medewerkerPasskeys.deviceLabel,
      aangemaakt: schema.medewerkerPasskeys.aangemaakt,
    })
    .from(schema.medewerkerPasskeys)
    .where(eq(schema.medewerkerPasskeys.medewerkerId, sessie.medewerkerId));
  return NextResponse.json({
    aantal: rows.length,
    devices: rows.map((r) => ({
      deviceLabel: r.deviceLabel,
      aangemaakt: r.aangemaakt.toISOString(),
    })),
  });
}
