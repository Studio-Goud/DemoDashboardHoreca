/**
 * POST /api/shiftbase/refresh-beschikbaarheid
 *   → { ok: true }
 *
 * Forceert revalidation van de Shiftbase-beschikbaarheid-cache zodat de
 * volgende GET op de rooster-pagina een verse fetch doet (i.p.v. de
 * 30-seconden cache te wachten). Gebruikt door de "Refresh"-knop op de
 * rooster-pagina, totdat medewerkers hun beschikbaarheid via de app
 * zelf invoeren.
 *
 * Owner of manager mag dit triggeren. Rate-limit: 1× per 5s per IP zodat
 * iemand 'm niet kan spammen.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { ipUitRequest, registreerPoging } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }

  // Max 6 refreshes per minuut per IP — voorkomt accidentele knop-spam.
  const rate = await registreerPoging(`sb-refresh:${ipUitRequest(req)}`, 6, 60);
  if (rate.geblokkeerd) {
    return NextResponse.json(
      { error: `Rustig aan — wacht ${rate.restSec}s` },
      { status: 429 },
    );
  }

  revalidateTag("shiftbase-beschikbaarheid");
  return NextResponse.json({ ok: true });
}
