import { NextResponse } from "next/server";
import {
  valideerRegistratieToken,
  valideerRegistratieCodeMetEmail,
  voltooidRegistratie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET: valideert een registratie-token uit een email-link. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token ontbreekt" }, { status: 400 });
  const info = await valideerRegistratieToken(token);
  if (!info) return NextResponse.json({ error: "Token ongeldig of verlopen" }, { status: 410 });
  return NextResponse.json({ voornaam: info.voornaam, email: info.email });
}

/**
 * POST: stelt PIN in en activeert het account.
 * Accepteert twee flows:
 *  1. { token, pin }              — email-link flow (lange token uit URL)
 *  2. { email, code, pin }         — handmatige flow (6-cijferige code)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      email?: string;
      code?: string;
      pin?: string;
    };

    if (!body.pin) {
      return NextResponse.json({ error: "PIN verplicht" }, { status: 400 });
    }
    if (!/^\d{4,6}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN moet 4 tot 6 cijfers zijn" }, { status: 400 });
    }

    let info: { medewerkerId: number; voornaam: string; email: string } | null = null;

    if (body.token) {
      info = await valideerRegistratieToken(body.token);
    } else if (body.email && body.code) {
      info = await valideerRegistratieCodeMetEmail(body.email, body.code);
    } else {
      return NextResponse.json({
        error: "Geef ofwel token, of email + code mee",
      }, { status: 400 });
    }

    if (!info) {
      return NextResponse.json({
        error: "Gegevens onjuist of code verlopen — vraag manager om een nieuwe code",
      }, { status: 410 });
    }

    await voltooidRegistratie(info.medewerkerId, body.pin);
    return NextResponse.json({ ok: true, email: info.email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
