/**
 * Owner-only Shiftbase-migratie endpoint.
 *
 * POST /api/admin/migreer-shiftbase
 *   body: { dagenHistorie?: number, dagenVooruit?: number }
 *
 * Importeert departments, medewerkers, shift-templates, rosters en
 * beschikbaarheid uit Shiftbase naar eigen Postgres. Idempotent.
 *
 * maxDuration = 300s (Pro plan). Bij Hobby kan 60s te krap zijn voor
 * vol jaar × 3 vestigingen; gewoon opnieuw aanroepen (idempotent).
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { migreerShiftbase } from "@/lib/shiftbase-migratie";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
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
