/**
 * GET /api/leaderboard/medewerker/[bedrijf]?venster=30
 * → { rijen: ScoreRij[], venster, gegenereerdOp }
 *
 * Owner/manager-only. Toont de medewerker-leaderboard voor het bedrijf
 * over het opgegeven venster (default 30 dagen).
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { berekenLeaderboard } from "@/lib/medewerker-score";
import { getDemoLeaderboard } from "@/lib/demo/api-responses";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["bb", "sl", "kl"]);

export async function GET(req: Request, { params }: { params: { bedrijf: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }
  const bedrijfSlug = params.bedrijf;
  if (!ALLOWED.has(bedrijfSlug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }

  const url = new URL(req.url);
  const vensterRaw = parseInt(url.searchParams.get("venster") || "30", 10);
  const venster = Number.isFinite(vensterRaw) && vensterRaw > 0 && vensterRaw <= 365
    ? vensterRaw : 30;

  const rijen = DEMO_MODE
    ? getDemoLeaderboard(bedrijfSlug as "bb" | "sl" | "kl", venster)
    : await berekenLeaderboard({ bedrijfSlug, venster });
  return NextResponse.json({
    rijen,
    venster,
    gegenereerdOp: new Date().toISOString(),
  });
}
