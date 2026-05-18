/**
 * GET /api/cron/shiftbase-sync — dagelijkse rooster-sync (Vercel Cron).
 *
 * Pakt 30 dagen achterstand + 90 dagen vooruit. Medewerkers worden ook
 * ge-upsert zodat nieuwe collega's in Shiftbase niet "onbekend" blijven
 * voor de dashboard-aggregaties.
 *
 * Voor backfill van een vol jaar: gebruik /api/admin/shiftbase/sync.
 */
import { NextRequest, NextResponse } from "next/server";
import { syncShiftbaseRosters, syncShiftbaseBeschikbaarheid } from "@/lib/shiftbase-sync";

export const maxDuration = 300; // 5 min

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rosters = await syncShiftbaseRosters({
      dagenTerug: 30,
      dagenVooruit: 90,
      ookMedewerkers: true,
    });
    // Beschikbaarheid alleen voor komende 8 weken — verleden is irrelevant
    // en de Shiftbase API geeft anders enorme dumps.
    const beschikbaarheid = await syncShiftbaseBeschikbaarheid().catch((e) => ({
      opgehaald: 0, nieuw: 0, bijgewerkt: 0,
      overgeslagenOnbekend: 0, overgeslagenGeenKoppeling: 0,
      ongekoppeldeShiftbaseIds: [],
      vanDatum: "", totDatum: "", duurMs: 0,
      errors: [e instanceof Error ? e.message : "fout"],
    }));
    return NextResponse.json({ ok: true, rosters, beschikbaarheid });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fout" },
      { status: 500 },
    );
  }
}
