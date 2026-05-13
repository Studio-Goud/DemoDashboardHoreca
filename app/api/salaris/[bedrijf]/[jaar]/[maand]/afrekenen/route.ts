/**
 * Markeer een maand als afgerekend voor 1 of meerdere medewerkers.
 *
 * POST /api/salaris/[bedrijf]/[jaar]/[maand]/afrekenen
 *   body: { medewerkerIds: number[] }  // optie: leeg = alles van die maand
 *
 * Vereist owner-rol. Na afrekenen blijft de berekening bevroren — verdere
 * wijzigingen aan rosters of klok-events in die maand veranderen het bedrag
 * niet meer, maar worden wel zichtbaar als hash-mismatch in het rapport.
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { berekenSalarisVoorBedrijf, slaSalarisPeriodeOp, markeerAfgerekend } from "@/lib/salaris";
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
    return NextResponse.json({ error: "alleen owner mag afrekenen" }, { status: 403 });
  }
  if (!(VALID as string[]).includes(params.bedrijf)) {
    return NextResponse.json({ error: "onbekend bedrijf" }, { status: 400 });
  }
  const jaar = Number(params.jaar);
  const maand = Number(params.maand);
  if (!Number.isInteger(jaar) || jaar < 2020 || !Number.isInteger(maand) || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "ongeldig jaar/maand" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { medewerkerIds?: number[] };
  const filter = Array.isArray(body.medewerkerIds) ? new Set(body.medewerkerIds) : null;

  try {
    // Eerst even alles uitrekenen + persisten zodat we zeker zijn dat de bedragen
    // up-to-date zijn vóór afrekenen
    const berekeningen = await berekenSalarisVoorBedrijf(params.bedrijf as Bedrijf, jaar, maand);
    const targets = filter
      ? berekeningen.filter((b) => filter.has(b.medewerkerId))
      : berekeningen;

    for (const b of targets) {
      await slaSalarisPeriodeOp(b);
      await markeerAfgerekend(b.medewerkerId, jaar, maand, sessie.medewerkerId);
    }

    return NextResponse.json({
      ok: true,
      aantalAfgerekend: targets.length,
      medewerkers: targets.map((t) => ({
        id: t.medewerkerId,
        naam: `${t.voornaam} ${t.achternaam}`,
        totaalEur: t.totaalEur,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
