/**
 * Owner-only: eenmalige backfill van de volledige Zettle-historie naar de
 * Postgres tabel `zettle_transacties`. Daarna leest het dashboard / forecast
 * / AI uit de DB ipv de iZettle paginated REST API. Idempotent — herhalen
 * voegt geen duplicaten toe (UNIQUE op bedrijf+purchase_uuid).
 *
 * POST /api/administratie/zettle-snapshot
 *   body: { bedrijf?: "bb" | "sl" | "kl" }   // weglaten = alle 3
 *
 * maxDuration = 300s (Vercel Pro). Eerste run voor een bedrijf met veel
 * historie kan ~1-3 min duren. Re-run is veilig.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { backfillBedrijf, backfillAlle } from "@/lib/zettle-sync";
import type { Bedrijf } from "@/lib/zettle";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GELDIGE_BEDRIJVEN = new Set<Bedrijf>(["bb", "sl", "kl"]);

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag snapshot draaien" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { bedrijf?: string };
  const start = Date.now();

  if (body.bedrijf) {
    if (!GELDIGE_BEDRIJVEN.has(body.bedrijf as Bedrijf)) {
      return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
    }
    const resultaat = await backfillBedrijf(body.bedrijf as Bedrijf);
    return NextResponse.json({
      ok: !resultaat.fout,
      duurMs: Date.now() - start,
      resultaten: [resultaat],
    });
  }

  const resultaten = await backfillAlle();
  return NextResponse.json({
    ok: resultaten.every((r) => !r.fout),
    duurMs: Date.now() - start,
    resultaten,
  });
}
