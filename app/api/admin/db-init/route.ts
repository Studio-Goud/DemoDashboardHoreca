/**
 * Owner-only DB-init endpoint.
 *
 * POST /api/admin/db-init → leest drizzle/*.sql en voert ze uit tegen
 * de live Postgres. Idempotent (CREATE TABLE IF NOT EXISTS).
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const sessie = huidigeAdminSessie();
  if (!sessie) {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag DB initialiseren" }, { status: 403 });
  }

  try {
    const resultaten = await runAllePendingMigraties();
    return NextResponse.json({ ok: true, resultaten });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
