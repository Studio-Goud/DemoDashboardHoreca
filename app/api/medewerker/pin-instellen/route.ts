/**
 * POST /api/medewerker/pin-instellen
 *   body: { pin }                — vereist actieve sessie
 *   → { ok: true }
 *
 * Zet of wijzigt de PIN voor de ingelogde medewerker. Sneller dan
 * wachtwoord-login op mobiel. Wachtwoord blijft als fallback bestaan.
 */
import { NextResponse } from "next/server";
import { huidigeSessie, zetMedewerkerPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!body.pin || !/^\d{4,6}$/.test(body.pin)) {
    return NextResponse.json({ error: "PIN moet 4 tot 6 cijfers zijn" }, { status: 400 });
  }

  // Default-PIN expliciet weigeren — moet_pin_resetten zou anders gewist worden
  // zonder dat de medewerker er werkelijk een eigen code voor in de plaats zet.
  // Andere zwakke PINs (0000 / 1111 / opeenvolgend) laten we tot owner-policy.
  if (body.pin === "1234") {
    return NextResponse.json(
      { error: "Kies een andere PIN dan 1234" },
      { status: 400 },
    );
  }

  try {
    await zetMedewerkerPin(sessie.medewerkerId, body.pin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fout" }, { status: 500 });
  }
}
