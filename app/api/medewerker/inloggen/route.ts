import { NextResponse } from "next/server";
import { inloggenMedewerker } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; pin?: string };
    if (!body.email || !body.pin) {
      return NextResponse.json({ error: "email + pin verplicht" }, { status: 400 });
    }
    const sessie = await inloggenMedewerker(body.email, body.pin);
    if (!sessie) {
      // Vermijd "user niet gevonden" vs "PIN fout" onderscheid (timing-leak)
      return NextResponse.json({ error: "Onjuiste e-mail of PIN" }, { status: 401 });
    }
    return NextResponse.json({
      ok: true,
      naam: sessie.naam,
      vestiging: sessie.vestiging,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
