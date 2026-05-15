/**
 * GET  /api/admin/review-kanalen?bedrijf=bb → { googleReviewUrl, tripadvisorReviewUrl }
 * POST /api/admin/review-kanalen
 *   body: { bedrijf, googleReviewUrl?, tripadvisorReviewUrl? }
 *   → { ok: true }
 *
 * Owner zet review-deeplinks per bedrijf. Klanten worden via /r/[token]
 * doorgestuurd naar deze URLs.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["bb", "sl", "kl"]);

function valideerUrl(s: string | undefined | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

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
  const [d] = await db.select({
    googleReviewUrl: schema.departments.googleReviewUrl,
    tripadvisorReviewUrl: schema.departments.tripadvisorReviewUrl,
  }).from(schema.departments).where(eq(schema.departments.slug, bedrijf));
  if (!d) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
  return NextResponse.json({
    googleReviewUrl: d.googleReviewUrl ?? "",
    tripadvisorReviewUrl: d.tripadvisorReviewUrl ?? "",
  });
}

export async function POST(req: Request) {
  await runAllePendingMigraties().catch(() => null);

  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    bedrijf?: string;
    googleReviewUrl?: string;
    tripadvisorReviewUrl?: string;
  };
  if (!body.bedrijf || !ALLOWED.has(body.bedrijf)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }

  await db.update(schema.departments)
    .set({
      googleReviewUrl: valideerUrl(body.googleReviewUrl),
      tripadvisorReviewUrl: valideerUrl(body.tripadvisorReviewUrl),
    })
    .where(eq(schema.departments.slug, body.bedrijf));

  return NextResponse.json({ ok: true });
}
