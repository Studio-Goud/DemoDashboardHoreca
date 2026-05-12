import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createRoster } from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];
function isBedrijf(s: unknown): s is Bedrijf {
  return typeof s === "string" && (VALID as string[]).includes(s);
}

export async function POST(req: Request) {
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
    if (!body.userId || !body.datum || !body.start || !body.eind)
      return NextResponse.json(
        { error: "userId, datum, start, eind verplicht" },
        { status: 400 },
      );

    const { id } = await createRoster({
      bedrijf: body.bedrijf as Bedrijf,
      userId: body.userId,
      datum: body.datum,
      start: body.start,
      eind: body.eind,
      shiftTemplateId: body.shiftTemplateId,
      pauzeMin: body.pauzeMin,
      notitie: body.notitie,
      gepubliceerd: body.gepubliceerd,
    });

    revalidateTag("shiftbase");
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
