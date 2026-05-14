/**
 * GET /api/cashflow/[bedrijf]?dagen=90
 *   → CashflowProjectie
 *
 * Owner-only — bevat saldo + per-dag projectie. Manager mag het niet zien
 * (saldo is privé-financiele info).
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { cashflowProjectie, type BedrijfSlug } from "@/lib/cashflow";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GELDIGE = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

export async function GET(req: Request, { params }: { params: { bedrijf: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }
  if (!GELDIGE.has(params.bedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  await runAllePendingMigraties().catch(() => null);
  const { searchParams } = new URL(req.url);
  const dagen = Math.min(180, Math.max(7, Number(searchParams.get("dagen") ?? 90)));
  const projectie = await cashflowProjectie(params.bedrijf as BedrijfSlug, dagen);
  return NextResponse.json(projectie);
}
