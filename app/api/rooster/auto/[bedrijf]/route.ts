import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { genereerAutoRooster } from "@/lib/rooster-auto";
import { genereerAutoRoosterAi } from "@/lib/rooster-auto-ai";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];

export async function POST(
  req: Request,
  { params }: { params: { bedrijf: string } },
) {
  try {
    if (!(VALID as string[]).includes(params.bedrijf)) {
      return NextResponse.json({ error: "onbekend bedrijf" }, { status: 400 });
    }
    const bedrijf = params.bedrijf as Bedrijf;

    const body = (await req.json().catch(() => ({}))) as {
      weekStart?: string;
      mode?: "heuristiek" | "ai";
    };
    if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
      return NextResponse.json({ error: "weekStart (YYYY-MM-DD) verplicht" }, { status: 400 });
    }

    const mode = body.mode === "ai" ? "ai" : "heuristiek";
    const resultaat = mode === "ai"
      ? await genereerAutoRoosterAi(bedrijf, body.weekStart)
      : await genereerAutoRooster(bedrijf, body.weekStart);

    revalidateTag("shiftbase");
    return NextResponse.json({ mode, ...resultaat });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
