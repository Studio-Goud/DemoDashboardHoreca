import { NextResponse } from "next/server";
import { syncAlleBedrijvenIncrementeel } from "@/lib/zettle-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Vercel Cron — dagelijks om 06:10 incrementeel Zettle-syncen. Zettle wijzigt
 * weinig per uur (POS is dagelijks gesloten), dus dagelijks volstaat. SumUp
 * draait elke 10 min apart.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const verwacht = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (verwacht && auth !== verwacht) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const resultaten = await syncAlleBedrijvenIncrementeel();
  const duur = Date.now() - start;

  return NextResponse.json({
    ok: true,
    duurMs: duur,
    resultaten,
    gegenereerd: new Date().toISOString(),
  });
}
