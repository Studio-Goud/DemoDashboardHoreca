import { NextResponse } from "next/server";
import { shiftTemplatesPerBedrijf } from "@/lib/shiftbase";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];

export async function GET(
  _req: Request,
  { params }: { params: { bedrijf: string } },
) {
  if (!(VALID as string[]).includes(params.bedrijf)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  try {
    const templates = await shiftTemplatesPerBedrijf(params.bedrijf as Bedrijf);
    return NextResponse.json({ templates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
