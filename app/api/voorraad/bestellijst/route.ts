import { NextResponse } from "next/server";
import { bestellijstAlleVestigingen } from "@/lib/voorraad";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await bestellijstAlleVestigingen();
    return NextResponse.json({ items, gegenereerd: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
