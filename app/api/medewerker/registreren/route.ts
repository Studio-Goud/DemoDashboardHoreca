import { NextResponse } from "next/server";
import { valideerRegistratieToken, voltooidRegistratie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET: valideert een registratie-token. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token ontbreekt" }, { status: 400 });
  const info = await valideerRegistratieToken(token);
  if (!info) return NextResponse.json({ error: "Token ongeldig of verlopen" }, { status: 410 });
  return NextResponse.json({ voornaam: info.voornaam, email: info.email });
}

/** POST: stelt PIN in en activeert het account. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; pin?: string };
    if (!body.token || !body.pin) {
      return NextResponse.json({ error: "token + pin verplicht" }, { status: 400 });
    }
    if (!/^\d{4,6}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN moet 4 tot 6 cijfers zijn" }, { status: 400 });
    }
    const info = await valideerRegistratieToken(body.token);
    if (!info) {
      return NextResponse.json({ error: "Token ongeldig of verlopen" }, { status: 410 });
    }
    await voltooidRegistratie(info.medewerkerId, body.pin);
    return NextResponse.json({ ok: true, email: info.email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
