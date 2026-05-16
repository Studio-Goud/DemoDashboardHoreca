/**
 * POST /api/admin/shiftbase/sync
 *   body: { dagenTerug?: number, dagenVooruit?: number }
 *
 * On-demand Shiftbase → DB sync. Default 365 dagen terug + 90 vooruit voor
 * historische bezettingsadvies-data. Alleen owner mag dit triggeren want
 * 'ie kan minutenlang duren en doet veel API-calls richting Shiftbase.
 *
 * Resultaat-JSON bevat nieuw/bijgewerkt/overgeslagen tellers + duurMs zodat
 * de admin-UI kan tonen "x.xxx rosters gesynct in 47 sec".
 *
 * GET /api/admin/shiftbase/sync — geeft alleen status (geen actie):
 *   { laatsteSyncDatum, rosterAantalTotaal, oudsteRosterDatum }
 */
import { NextResponse } from "next/server";
import { count, min, max, lt } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { syncShiftbaseRosters } from "@/lib/shiftbase-sync";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie || sessie.rol !== "owner") {
    return NextResponse.json(
      { error: "Alleen owner mag een Shiftbase-sync starten" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    dagenTerug?: number;
    dagenVooruit?: number;
  };

  const dagenTerug = Math.min(Math.max(body.dagenTerug ?? 365, 1), 730);
  const dagenVooruit = Math.min(Math.max(body.dagenVooruit ?? 90, 0), 180);

  try {
    const result = await syncShiftbaseRosters({
      dagenTerug,
      dagenVooruit,
      ookMedewerkers: true,
    });

    await logAudit("roster", 0, "create",
      null,
      { actie: "shiftbase-sync", door: sessie.naam, ...result },
      { doorRol: sessie.rol, reden: `Backfill ${dagenTerug}d terug + ${dagenVooruit}d vooruit` },
    );

    return NextResponse.json({ ok: true, dagenTerug, dagenVooruit, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fout" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const sessie = huidigeAdminSessie();
  if (!sessie) {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const vandaag = new Date().toISOString().slice(0, 10);

  const [totaalRow] = await db
    .select({ aantal: count() })
    .from(schema.rosters);
  const [rangeRow] = await db
    .select({ oudste: min(schema.rosters.datum), nieuwste: max(schema.rosters.datum) })
    .from(schema.rosters);
  const [historischRow] = await db
    .select({ aantal: count() })
    .from(schema.rosters)
    .where(lt(schema.rosters.datum, vandaag));

  return NextResponse.json({
    totaal: totaalRow?.aantal ?? 0,
    oudste: rangeRow?.oudste ?? null,
    nieuwste: rangeRow?.nieuwste ?? null,
    historisch: historischRow?.aantal ?? 0,
  });
}
