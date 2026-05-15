/**
 * Owner/manager login → zet HttpOnly admin-cookie.
 *
 * POST /api/admin/login
 *   body: { pin: "2026", vestiging?: "bb" }
 *
 * Aangeroepen door PinGate na een succesvolle PIN-validatie. PinGate
 * blijft de UI-zijde doen (PIN-pad, fout-flash), deze route persist de
 * sessie server-side zodat API-endpoints kunnen autoriseren.
 */
import { NextResponse } from "next/server";
import { verifieerAdminPin, zetAdminCookie, wisAdminCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    pin?: string;
    vestiging?: "bb" | "sl" | "kl";
    gewensteRol?: "owner" | "manager";
  };

  if (!body.pin || !/^\d{4}$/.test(body.pin)) {
    return NextResponse.json({ error: "ongeldig PIN-formaat" }, { status: 400 });
  }

  const sessie = verifieerAdminPin(body.pin, body.vestiging, body.gewensteRol);
  if (!sessie) {
    return NextResponse.json({ error: "onjuiste PIN" }, { status: 401 });
  }

  zetAdminCookie(sessie);
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
