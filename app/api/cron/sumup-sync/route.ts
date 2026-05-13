import { NextResponse } from "next/server";
import { syncAlleBedrijvenIncrementeel } from "@/lib/sumup-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron endpoint — wordt elke 10 minuten aangeroepen om SumUp-data
 * naar Postgres te syncen. Beveiligd met `CRON_SECRET` header.
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
