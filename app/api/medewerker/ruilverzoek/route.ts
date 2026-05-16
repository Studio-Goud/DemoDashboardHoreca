/**
 * GET  /api/medewerker/ruilverzoek            → inbox (eigen + open in vestiging)
 * POST /api/medewerker/ruilverzoek            → nieuw ruilverzoek aanmaken
 *   body: { rosterId, toelichting? }
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import {
  ruilverzoekenInbox,
  maakRuilverzoek,
} from "@/lib/ruilverzoeken";
import { ruilverzoekCooldownActief } from "@/lib/medewerker-push";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const lijst = await ruilverzoekenInbox(sessie.medewerkerId);
  return NextResponse.json({ verzoeken: lijst, eigenId: sessie.medewerkerId });
}

export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }

  // Cooldown: max 1 ruilverzoek per uur per medewerker
  if (await ruilverzoekCooldownActief(sessie.medewerkerId)) {
    return NextResponse.json(
      { error: "Je hebt al binnen het afgelopen uur een ruilverzoek gestuurd. Wacht even." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    rosterId?: number;
    toelichting?: string;
  };
  if (!body.rosterId || !Number.isFinite(body.rosterId)) {
    return NextResponse.json({ error: "rosterId vereist" }, { status: 400 });
  }
  const toelichting = body.toelichting?.trim() || undefined;
  if (toelichting && toelichting.length > 280) {
    return NextResponse.json({ error: "toelichting max 280 tekens" }, { status: 400 });
  }

  try {
    const { id, doelAantal } = await maakRuilverzoek({
      rosterId: body.rosterId,
      aanvragerId: sessie.medewerkerId,
      toelichting,
    });
    return NextResponse.json({ ok: true, id, doelAantal });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fout" },
      { status: 400 },
    );
  }
}
