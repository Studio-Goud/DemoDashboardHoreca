/**
 * Owner-only Shiftbase-migratie endpoint.
 *
 * POST /api/admin/migreer-shiftbase
 *   body: { dagenHistorie?: number, dagenVooruit?: number }
 *
 * Importeert departments, medewerkers, shift-templates, rosters en
 * beschikbaarheid uit Shiftbase naar eigen Postgres. Idempotent — meerdere
 * keren draaien is veilig.
 *
 * Lange-loop endpoint: maxDuration = 300s (5 min, Pro plan). Bij Hobby
 * plan kan 60s te krap zijn voor 12 maanden historie × 3 vestigingen;
 * dan gewoon opnieuw aanroepen (idempotent — pakt verder waar gestopt).
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { migreerShiftbase } from "@/lib/shiftbase-migratie";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie) {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag migreren" }, { status: 403 });
  }

  if (!process.env.SHIFTBASE_API_KEY) {
    return NextResponse.json(
      { error: "SHIFTBASE_API_KEY ontbreekt in productie-env. Voeg toe via Vercel dashboard." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    dagenHistorie?: number;
    dagenVooruit?: number;
  };

  try {
    const resultaat = await migreerShiftbase({
      dagenHistorie: body.dagenHistorie ?? 365,
      dagenVooruit:  body.dagenVooruit  ?? 90,
    });
    return NextResponse.json({ ok: true, ...resultaat });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
