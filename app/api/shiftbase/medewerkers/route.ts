import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  medewerkersPerBedrijf,
  fetchMedewerkers,
  createMedewerker,
  type Medewerker,
} from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";
import { huidigeAdminSessie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];
function isBedrijf(s: string | null): s is Bedrijf {
  return s !== null && (VALID as string[]).includes(s);
}

/** Strip salaris-data uit een medewerker — voor non-owner audiences. */
function maskSalaris(m: Medewerker): Medewerker {
  return { ...m, uurloon: null, vakantiegeldPct: 0, vakantieUrenPct: 0 };
}

export async function GET(req: Request) {
  // Auth: zonder admin-sessie geen toegang tot medewerker-lijst.
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  const isOwner = sessie.rol === "owner";

  const url = new URL(req.url);
  const bedrijf = url.searchParams.get("bedrijf");

  // Vestiging-isolatie: manager mag alleen eigen vestiging zien.
  if (sessie.rol === "manager" && isBedrijf(bedrijf) && bedrijf !== sessie.vestiging) {
    return NextResponse.json({ error: "geen toegang tot andere vestiging" }, { status: 403 });
  }
  // Manager zonder bedrijf-param → forceer 'm op eigen vestiging.
  const effectievBedrijf = sessie.rol === "manager" && sessie.vestiging
    ? (sessie.vestiging as Bedrijf)
    : (isBedrijf(bedrijf) ? bedrijf : null);

  try {
    const lijst = effectievBedrijf
      ? await medewerkersPerBedrijf(effectievBedrijf)
      : await fetchMedewerkers();
    // Privacy: alleen owner ziet de uurloon-velden.
    const veilig = isOwner ? lijst : lijst.map(maskSalaris);
    return NextResponse.json({ medewerkers: veilig });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // Auth + owner-only: medewerkers aanmaken hoort bij owner.
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag medewerkers aanmaken" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      bedrijf?: string;
      voornaam?: string;
      achternaam?: string;
      email?: string;
      startdatum?: string;
    };
    if (!isBedrijf(body.bedrijf ?? null))
      return NextResponse.json({ error: "bedrijf ontbreekt of ongeldig" }, { status: 400 });
    if (!body.voornaam || !body.achternaam || !body.email)
      return NextResponse.json({ error: "voornaam, achternaam, email verplicht" }, { status: 400 });

    const { id } = await createMedewerker({
      bedrijf: body.bedrijf as Bedrijf,
      voornaam: body.voornaam,
      achternaam: body.achternaam,
      email: body.email,
      startdatum: body.startdatum,
    });

    revalidateTag("shiftbase-medewerkers");
    revalidateTag("shiftbase");
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
