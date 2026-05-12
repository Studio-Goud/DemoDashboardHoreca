import { NextResponse } from "next/server";
import { uitloggen } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await uitloggen();
  return NextResponse.json({ ok: true });
}
