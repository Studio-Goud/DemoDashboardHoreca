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
  req: Request,
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

  // Zorg dat hoofd_department_id + werkgeverslasten_pct kolommen bestaan.
  await runAllePendingMigraties().catch(() => null);

  const { searchParams } = new URL(req.url);
  const opties = {
    metWerkgeverslasten: searchParams.get("metWerkgeverslasten") === "true",
    metVakantieOpslag:   searchParams.get("metVakantieOpslag") === "true",
  };

  const overzicht = await berekenInleenMaand(jaar, maand, opties);

  // Privacy: manager mag wel zien WAT er gefactureerd wordt en HOEVEEL uren,
  // maar NIET het uurloon of het exacte bedrag per medewerker. Voor manager
  // strippen we de regels en houden alleen totalen per (van, naar)-paar +
  // namen/uren (zonder uurloon/bedrag) als context.
  if (sessie.rol === "manager") {
    overzicht.paren = overzicht.paren.map((p) => ({
      ...p,
      regels: p.regels.map((r) => ({
        medewerkerId: r.medewerkerId,
        voornaam: r.voornaam,
        achternaam: r.achternaam,
        uren: r.uren,
        // expliciet verbergen — owner-only data
        uurloon: 0,
        bedrag: 0,
      })),
    }));
  }

  return NextResponse.json(overzicht);
}
