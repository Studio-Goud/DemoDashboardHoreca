/**
 * GET /api/m/mijn-vandaag
 * → { scans, klikken, laatste }
 *
 * Live-counter voor de medewerker-eigen QR-pagina. Poll elke 5s.
 */
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { apiVereistGoedgekeurdeMedewerker } from "@/lib/medewerker-gate";
import { db, schema } from "@/lib/db/client";
import { vandaagIso } from "@/lib/review-token";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await apiVereistGoedgekeurdeMedewerker();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const vandaag = vandaagIso();
  const rijen = await db
    .select({ id: schema.reviewReferrals.id, status: schema.reviewReferrals.status, geregistreerdOp: schema.reviewReferrals.geregistreerdOp })
    .from(schema.reviewReferrals)
    .where(and(
      eq(schema.reviewReferrals.medewerkerId, gate.sessie.medewerkerId),
      eq(schema.reviewReferrals.datum, vandaag),
    ))
    .orderBy(desc(schema.reviewReferrals.geregistreerdOp));

  const scans = rijen.length;
  const klikken = rijen.filter((r) => r.status !== "scan").length;
  const laatste = rijen[0]
    ? { status: rijen[0].status, geregistreerdOp: rijen[0].geregistreerdOp.toISOString() }
    : null;

  return NextResponse.json({ scans, klikken, laatste });
}
