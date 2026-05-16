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
import { syncShiftbaseRosters } from "@/lib/shiftbase-sync";

export const maxDuration = 300; // 5 min

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncShiftbaseRosters({
      dagenTerug: 30,
      dagenVooruit: 90,
      ookMedewerkers: true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fout" },
      { status: 500 },
    );
  }
}
