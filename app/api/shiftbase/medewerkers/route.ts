import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  medewerkersPerBedrijf,
  fetchMedewerkers,
  createMedewerker,
} from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];
function isBedrijf(s: string | null): s is Bedrijf {
  return s !== null && (VALID as string[]).includes(s);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bedrijf = url.searchParams.get("bedrijf");
  try {
    if (isBedrijf(bedrijf)) {
      const lijst = await medewerkersPerBedrijf(bedrijf);
      return NextResponse.json({ medewerkers: lijst });
    }
    const alle = await fetchMedewerkers();
    return NextResponse.json({ medewerkers: alle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
