import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { publiceerWeek } from "@/lib/rooster";
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
      start?: string;     // YYYY-MM-DD
      eind?: string;      // YYYY-MM-DD
    };
    if (!isBedrijf(body.bedrijf))
      return NextResponse.json({ error: "bedrijf verplicht" }, { status: 400 });
    if (!body.start || !body.eind)
      return NextResponse.json({ error: "start en eind verplicht" }, { status: 400 });

    const aantal = await publiceerWeek(body.bedrijf as Bedrijf, body.start, body.eind);
    revalidateTag("shiftbase");
    return NextResponse.json({ gepubliceerd: aantal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
