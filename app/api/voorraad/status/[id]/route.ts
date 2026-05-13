import { NextResponse } from "next/server";
import { setStatus } from "@/lib/voorraad";
import { huidigeSessie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { aantal?: number };
    if (typeof body.aantal !== "number" || !Number.isFinite(body.aantal) || body.aantal < 0) {
      return NextResponse.json({ error: "aantal verplicht (>=0)" }, { status: 400 });
    }
    const sessie = await huidigeSessie();
    await setStatus(params.id, body.aantal, sessie?.medewerkerId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
