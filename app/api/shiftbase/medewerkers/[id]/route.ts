import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateMedewerker, deleteMedewerker } from "@/lib/rooster";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json()) as {
      voornaam?: string;
      achternaam?: string;
      email?: string;
      startdatum?: string;
      einddatum?: string | null;
      uurloon?: number | null;
      vakantiegeldPct?: number;
      vakantieUrenPct?: number;
    };
    await updateMedewerker(params.id, body);
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
