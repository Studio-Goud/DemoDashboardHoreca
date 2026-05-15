/**
 * Owner/manager login → zet HttpOnly admin-cookie.
 *
 * POST /api/admin/login
 *   body: { pin: "2026", vestiging?: "bb", gewensteRol?: "owner"|"manager" }
 *
 * Twee fases:
 *  1. Client geeft alleen `pin`. Server valideert tegen ADMIN_PIN_PROFIEL
 *     (server-only — niet meer in de JS bundle). Bij owner zetten we direct
 *     de cookie. Bij manager retourneren we { vraagVestiging: true, naam,
 *     rol } zonder cookie — UI laat de vestiging-keuze zien.
 *  2. Voor manager komt een tweede call met `pin + vestiging` om de cookie
 *     ALSNOG te zetten met de juiste vestiging.
 *
 * Rate-limit: KV-backed teller per IP. 5 pogingen / 15 min → 429. Bij
 * succes wordt de teller gereset.
 */
import { NextResponse } from "next/server";
import {
  ADMIN_PIN_PROFIEL,
  verifieerAdminPin,
  zetAdminCookie,
  wisAdminCookie,
} from "@/lib/admin-auth";
import { ipUitRequest, registreerPoging, resetPoging } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_POGINGEN = 10;
const VENSTER_SEC = 15 * 60;

export async function POST(req: Request) {
  const ip = ipUitRequest(req);
  const rate = await registreerPoging(`login:${ip}`, MAX_POGINGEN, VENSTER_SEC);
  if (rate.geblokkeerd) {
    return NextResponse.json(
      { error: `Te veel pogingen. Probeer over ${Math.ceil(rate.restSec / 60)} min opnieuw.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    pin?: string;
    vestiging?: "bb" | "sl" | "kl";
    gewensteRol?: "owner" | "manager";
  };

  if (!body.pin || !/^\d{4}$/.test(body.pin)) {
    return NextResponse.json({ error: "ongeldig PIN-formaat" }, { status: 400 });
  }

  // Server-side PIN lookup — PIN_PROFIEL zit NIET meer in de client bundle.
  const profiel = ADMIN_PIN_PROFIEL[body.pin];
  if (!profiel) {
    return NextResponse.json({ error: "onjuiste PIN" }, { status: 401 });
  }

  // Manager-flow: PIN alleen → vraag eerst vestiging-keuze.
  if (profiel.rol === "manager" && !body.vestiging && body.gewensteRol !== "owner") {
    // Reset hier al — PIN klopt, alleen vestiging mist nog. Voorkomt dat
    // de manager-flow rate-limit consumeert tijdens vestiging-keuze.
    await resetPoging(`login:${ip}`);
    return NextResponse.json({
      vraagVestiging: true,
      rol: "manager",
      naam: profiel.naam,
    });
  }

  // Volledige sessie bouwen (incl. view-as ondersteuning voor owners)
  const sessie = verifieerAdminPin(body.pin, body.vestiging, body.gewensteRol);
  if (!sessie) {
    return NextResponse.json({ error: "onjuiste PIN" }, { status: 401 });
  }

  // Manager moet vestiging hebben — kan via expliciete body.vestiging of
  // (zeldzaam) owner-in-manager-view die expliciet 'n vestiging meegeeft.
  if (sessie.rol === "manager" && !sessie.vestiging) {
    return NextResponse.json({
      vraagVestiging: true,
      rol: "manager",
      naam: sessie.naam,
    });
  }

  zetAdminCookie(sessie);
  await resetPoging(`login:${ip}`);
  return NextResponse.json({
    ok: true,
    rol: sessie.rol,
    naam: sessie.naam,
    vestiging: sessie.vestiging,
  });
}

/**
 * Logout — wis de cookie.
 */
export async function DELETE() {
  wisAdminCookie();
  return NextResponse.json({ ok: true });
}
