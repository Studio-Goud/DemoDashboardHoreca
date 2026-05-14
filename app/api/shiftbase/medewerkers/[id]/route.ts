import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateMedewerker, deleteMedewerker, type MedewerkerPatch } from "@/lib/rooster";
import { huidigeAdminSessie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const sessie = huidigeAdminSessie();
    if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
    if (sessie.rol !== "owner" && sessie.rol !== "manager") {
      return NextResponse.json({ error: "geen rechten" }, { status: 403 });
    }

    const body = (await req.json()) as {
      voornaam?: string;
      achternaam?: string;
      email?: string;
      startdatum?: string;
      einddatum?: string | null;
      uurloon?: number | null;
      vakantiegeldPct?: number;
      vakantieUrenPct?: number;
      hoofdDepartmentId?: number | null;
    };

    // Privacy guard: alleen owner mag salaris-velden zetten. Manager-PUT
    // strippen we de salaris-velden defensief weg, ook als de client per
    // ongeluk of kwaadwillig wat meestuurt.
    const patch: MedewerkerPatch = {
      voornaam: body.voornaam,
      achternaam: body.achternaam,
      email: body.email,
      startdatum: body.startdatum,
      einddatum: body.einddatum,
      hoofdDepartmentId: body.hoofdDepartmentId,
    };
    if (sessie.rol === "owner") {
      patch.uurloon         = body.uurloon;
      patch.vakantiegeldPct = body.vakantiegeldPct;
      patch.vakantieUrenPct = body.vakantieUrenPct;
    }

    await updateMedewerker(params.id, patch);
    revalidateTag("shiftbase-medewerkers");
    revalidateTag("shiftbase");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await deleteMedewerker(params.id);
    revalidateTag("shiftbase-medewerkers");
    revalidateTag("shiftbase");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
