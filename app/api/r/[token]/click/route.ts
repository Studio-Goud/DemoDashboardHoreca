/**
 * POST /api/r/[token]/click
 *   body: { platform: "google" | "tripadvisor" }
 *
 * Klant klikte op een platform-knop. Upgrade de laatste 'scan' van deze
 * (medewerker, IP) van vandaag naar status='google'|'tripadvisor'. Als er
 * geen recente scan is (bijv. directe link zonder landing), maak nieuwe rij.
 */
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { verifieerReviewToken } from "@/lib/review-token";
import { ipUitRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const verifieerd = verifieerReviewToken(params.token);
  if (!verifieerd) return NextResponse.json({ error: "ongeldige token" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  if (body.platform !== "google" && body.platform !== "tripadvisor") {
    return NextResponse.json({ error: "platform moet google of tripadvisor zijn" }, { status: 400 });
  }

  const ip = ipUitRequest(req);
  const ipHash = createHash("sha256").update(ip + ":" + verifieerd.medewerkerId).digest("hex").slice(0, 32);

  // Laatste scan binnen 5 minuten van dezelfde (medewerker, IP) — upgrade
  const recent = await db
    .select({ id: schema.reviewReferrals.id, status: schema.reviewReferrals.status, geregistreerdOp: schema.reviewReferrals.geregistreerdOp })
    .from(schema.reviewReferrals)
    .where(and(
      eq(schema.reviewReferrals.medewerkerId, verifieerd.medewerkerId),
      eq(schema.reviewReferrals.datum, verifieerd.datum),
      eq(schema.reviewReferrals.ipHash, ipHash),
    ))
    .orderBy(desc(schema.reviewReferrals.geregistreerdOp))
    .limit(1);

  const vijfMinuten = 5 * 60 * 1000;
  const laatste = recent[0];
  if (laatste && Date.now() - new Date(laatste.geregistreerdOp).getTime() < vijfMinuten) {
    await db.update(schema.reviewReferrals)
      .set({ status: body.platform })
      .where(eq(schema.reviewReferrals.id, laatste.id));
  } else {
    // Geen recente scan-rij — maak nieuwe (kan gebeuren als landing pagina
    // werd overgeslagen via cached redirect)
    const [m] = await db.select({ hoofdDepartmentId: schema.medewerkers.hoofdDepartmentId })
      .from(schema.medewerkers)
      .where(eq(schema.medewerkers.id, verifieerd.medewerkerId));
    let bedrijfSlug = "bb";
    if (m?.hoofdDepartmentId) {
      const [d] = await db.select({ slug: schema.departments.slug })
        .from(schema.departments)
        .where(eq(schema.departments.id, m.hoofdDepartmentId));
      if (d) bedrijfSlug = d.slug;
    }
    await db.insert(schema.reviewReferrals).values({
      medewerkerId: verifieerd.medewerkerId,
      bedrijfSlug,
      datum: verifieerd.datum,
      status: body.platform,
      ipHash,
    });
  }

  return NextResponse.json({ ok: true });
}
