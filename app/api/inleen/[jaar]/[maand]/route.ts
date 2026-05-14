/**
 * Inleen-doorberekenings-overzicht per maand.
 *
 * GET /api/inleen/[jaar]/[maand]
 *   → { jaar, maand, paren: [...], totaalBedrag }
 *
 * Owner of manager mag bekijken (manager is verantwoordelijk voor planning;
 * doorberekening helpt bij maand-afsluiting). Loont auto-migratie zodat de
 * hoofd_department_id-kolom uit migratie 0003 zeker bestaat.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { berekenInleenMaand } from "@/lib/inleen-doorbereken";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: { jaar: string; maand: string } },
) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }

  const jaar = Number(params.jaar);
  const maand = Number(params.maand);
  if (!Number.isFinite(jaar) || !Number.isFinite(maand) || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "jaar/maand ongeldig" }, { status: 400 });
  }

  // Zorg dat hoofd_department_id-kolom bestaat (idempotent).
  await runAllePendingMigraties().catch(() => null);

  const overzicht = await berekenInleenMaand(jaar, maand);
  return NextResponse.json(overzicht);
}
