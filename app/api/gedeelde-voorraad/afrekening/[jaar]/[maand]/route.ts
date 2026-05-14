/**
 * GET /api/gedeelde-voorraad/afrekening/[jaar]/[maand]
 *
 * Maand-afrekening: hoeveel SL doorfactureert aan elke andere vestiging
 * (per product gespecificeerd). Producten zonder prijs worden overgeslagen —
 * owner moet eerst de prijs zetten.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { maandAfrekening } from "@/lib/gedeelde-voorraad";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { jaar: string; maand: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }
  const jaar = Number(params.jaar);
  const maand = Number(params.maand);
  if (!Number.isFinite(jaar) || !Number.isFinite(maand) || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "jaar/maand ongeldig" }, { status: 400 });
  }
  const afrekening = await maandAfrekening(jaar, maand);
  return NextResponse.json(afrekening);
}
