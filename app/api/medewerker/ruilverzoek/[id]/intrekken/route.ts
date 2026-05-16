/**
 * DELETE /api/medewerker/ruilverzoek/[id]/intrekken
 *   → aanvrager trekt z'n eigen verzoek in (status → ingetrokken)
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { trekRuilverzoekIn } from "@/lib/ruilverzoeken";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ongeldige id" }, { status: 400 });
  }

  try {
    await trekRuilverzoekIn({ ruilverzoekId: id, aanvragerId: sessie.medewerkerId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fout" },
      { status: 400 },
    );
  }
}
