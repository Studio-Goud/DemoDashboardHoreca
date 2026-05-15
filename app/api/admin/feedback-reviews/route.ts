/**
 * GET  /api/admin/feedback-reviews?bedrijf=bb&dagen=30
 * → lijst recente klant-reviews (owner/manager view).
 *
 * PATCH /api/admin/feedback-reviews/[id]
 *   body: { verborgen: boolean }
 *   → soft-delete spam/fake review.
 */
import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["bb", "sl", "kl"]);

export async function GET(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }

  const url = new URL(req.url);
  const bedrijf = url.searchParams.get("bedrijf");
  if (!bedrijf || !ALLOWED.has(bedrijf)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  const dagenRaw = parseInt(url.searchParams.get("dagen") || "30", 10);
  const dagen = Number.isFinite(dagenRaw) && dagenRaw > 0 && dagenRaw <= 365 ? dagenRaw : 30;
  const van = format(subDays(new Date(), dagen), "yyyy-MM-dd");

  const rijen = await db
    .select()
    .from(schema.feedbackReviews)
    .where(and(
      eq(schema.feedbackReviews.bedrijfSlug, bedrijf),
      gte(schema.feedbackReviews.datum, van),
    ))
    .orderBy(desc(schema.feedbackReviews.ingediendOp))
    .limit(200);

  return NextResponse.json({ rijen });
}
