/**
 * POST /api/shiftbase/refresh-beschikbaarheid
 *   → { ok: true, nieuw, bijgewerkt, overgeslagen, duurMs }
 *
 * Synct beschikbaarheid uit Shiftbase naar de eigen DB voor de komende 8
 * weken. Gebruikt door de "Beschikbaarheid sync"-knop op de rooster-pagina
 * — voor wanneer medewerkers net iets in Shiftbase hebben aangepast en de
 * manager dat direct in het rooster wil zien.
 *
 * Verdwijnt zodra medewerkers volledig via /m/beschikbaarheid werken —
 * Shiftbase is dan niet meer de bron.
 *
 * Owner of manager mag dit triggeren. Rate-limit: 6× per minuut per IP.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { ipUitRequest, registreerPoging } from "@/lib/rate-limit";
import { syncShiftbaseBeschikbaarheid } from "@/lib/shiftbase-sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }

  const rate = await registreerPoging(`sb-refresh:${ipUitRequest(req)}`, 6, 60);
  if (rate.geblokkeerd) {
    return NextResponse.json(
      { error: `Rustig aan — wacht ${rate.restSec}s` },
      { status: 429 },
    );
  }

  // Invalideer de oude in-memory cache van Shiftbase-fetcher, dan sync naar DB.
  revalidateTag("shiftbase-beschikbaarheid");
  const result = await syncShiftbaseBeschikbaarheid();
  return NextResponse.json({ ok: true, ...result });
}
