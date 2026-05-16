/**
 * POST /api/medewerker/ruilverzoek/[id]/overnemen
 *   → reserveert het verzoek voor de huidige medewerker (status → gereserveerd)
 *
 * Eerste-die-klikt-wint: de DB-update voorwaarde `status = 'open'` zorgt
 * voor atomair claim-gedrag.
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { reserveerRuilverzoek } from "@/lib/ruilverzoeken";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ongeldige id" }, { status: 400 });
  }

  try {
    await reserveerRuilverzoek({ ruilverzoekId: id, overnemerId: sessie.medewerkerId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fout" },
      { status: 400 },
    );
  }
}
