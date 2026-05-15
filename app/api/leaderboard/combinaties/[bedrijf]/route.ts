/**
 * GET /api/leaderboard/combinaties/[bedrijf]?venster=60
 * → { rijen: CombiRij[], venster, gegenereerdOp }
 *
 * Top + onder-presterende team-paren over het venster. Owner/manager-only.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { berekenCombinaties } from "@/lib/team-combinaties";

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
  const vensterRaw = parseInt(url.searchParams.get("venster") || "60", 10);
  const venster = Number.isFinite(vensterRaw) && vensterRaw > 0 && vensterRaw <= 365 ? vensterRaw : 60;

  const rijen = await berekenCombinaties({ bedrijfSlug, venster });
  return NextResponse.json({ rijen, venster, gegenereerdOp: new Date().toISOString() });
}
