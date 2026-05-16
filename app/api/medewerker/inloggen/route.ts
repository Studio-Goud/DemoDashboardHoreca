import { NextResponse } from "next/server";
import { inloggenMedewerker } from "@/lib/auth";
import { ipUitRequest, registreerPoging, resetPoging } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_POGINGEN = 8;
const VENSTER_SEC = 15 * 60;

export async function POST(req: Request) {
  const ip = ipUitRequest(req);
  const rate = await registreerPoging(`mw-login:${ip}`, MAX_POGINGEN, VENSTER_SEC);
  if (rate.geblokkeerd) {
    return NextResponse.json(
      { error: `Te veel pogingen. Probeer over ${Math.ceil(rate.restSec / 60)} min opnieuw.` },
      { status: 429 },
    );
  }
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
    await resetPoging(`mw-login:${ip}`);
    return NextResponse.json({
      ok: true,
      naam: sessie.naam,
      vestiging: sessie.vestiging,
      moetPinResetten: sessie.moetPinResetten,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
