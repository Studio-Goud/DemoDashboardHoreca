import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateRoster, deleteRoster } from "@/lib/shiftbase";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];
function isBedrijf(s: unknown): s is Bedrijf {
  return typeof s === "string" && (VALID as string[]).includes(s);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json()) as {
      bedrijf?: string;
      userId?: string;
      datum?: string;
      start?: string;
      eind?: string;
      shiftTemplateId?: string;
      pauzeMin?: number;
      notitie?: string;
      gepubliceerd?: boolean;
    };
    if (!isBedrijf(body.bedrijf))
      return NextResponse.json({ error: "bedrijf ontbreekt of ongeldig" }, { status: 400 });

    await updateRoster(params.id, { ...body, bedrijf: body.bedrijf as Bedrijf });
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
    await deleteRoster(params.id);
    revalidateTag("shiftbase");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
