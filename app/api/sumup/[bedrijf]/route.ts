import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions, type Bedrijf } from "@/lib/sumup";
import { startOfDay, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as Bedrijf;
  if (!["bb", "sl"].includes(bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  try {
    const vandaag = new Date();
    const [laatste, vandaagTxs] = await Promise.all([
      fetchTransactions(bedrijf, { limit: 1 }),
      fetchTransactions(bedrijf, {
        oldest_time: startOfDay(vandaag).toISOString(),
        newest_time: endOfDay(vandaag).toISOString(),
        limit: 100,
      }),
    ]);

    const omzetVandaag = vandaagTxs.reduce((sum, tx) => sum + tx.amount, 0);

    return NextResponse.json({
      omzetVandaag: Math.round(omzetVandaag * 100) / 100,
      aantalTransactiesVandaag: vandaagTxs.length,
      laasteSale: laatste[0] ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
