/**
 * Markeer een medewerker als uitbetaald voor een specifieke maand.
 *
 * POST /api/salaris/[bedrijf]/[jaar]/[maand]/uitbetalen
 *   body: { medewerkerId: number, betalingReferentie: string }
 *
 * Vereist owner-rol. Bedoeld om na de bankoverschrijving de status definitief
 * te markeren met het bank-referentienummer voor latere koppeling.
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { markeerUitbetaald } from "@/lib/salaris";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];

export async function POST(
  req: Request,
  { params }: { params: { bedrijf: string; jaar: string; maand: string } },
) {
  const sessie = await huidigeSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag uitbetaling markeren" }, { status: 403 });
  }
  if (!(VALID as string[]).includes(params.bedrijf)) {
    return NextResponse.json({ error: "onbekend bedrijf" }, { status: 400 });
  }
  const jaar = Number(params.jaar);
  const maand = Number(params.maand);
  if (!Number.isInteger(jaar) || !Number.isInteger(maand) || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "ongeldig jaar/maand" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    medewerkerId?: number;
    betalingReferentie?: string;
  };

  if (!body.medewerkerId || !body.betalingReferentie) {
    return NextResponse.json(
      { error: "medewerkerId en betalingReferentie verplicht" },
      { status: 400 },
    );
  }

  try {
    await markeerUitbetaald(body.medewerkerId, jaar, maand, body.betalingReferentie);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
