import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions, type Bedrijf } from "@/lib/sumup";
import { startOfDay, endOfDay, parseISO, getHours } from "date-fns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        limit: 250,
      }),
    ]);

    const omzetVandaag = vandaagTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const gemBonVandaag =
      vandaagTxs.length > 0 ? omzetVandaag / vandaagTxs.length : 0;

    // Uur-verdeling vandaag
    const uurVerdeling = Array.from({ length: 24 }, (_, uur) => {
      const inUur = vandaagTxs.filter(
        (t) => getHours(parseISO(t.timestamp)) === uur
      );
      return {
        uur,
        omzet:
          Math.round(inUur.reduce((s, t) => s + t.amount, 0) * 100) / 100,
        txs: inUur.length,
      };
    });

    // Betaalmethoden aggregaat
    const betaalmethoden: Record<
      string,
      { omzet: number; aantal: number }
    > = {};
    for (const tx of vandaagTxs) {
      const sleutel = (tx.payment_type || "onbekend").toLowerCase();
      const b = betaalmethoden[sleutel] ?? { omzet: 0, aantal: 0 };
      b.omzet += tx.amount;
      b.aantal += 1;
      betaalmethoden[sleutel] = b;
    }
    for (const k of Object.keys(betaalmethoden)) {
      betaalmethoden[k].omzet =
        Math.round(betaalmethoden[k].omzet * 100) / 100;
    }

    const recenteTransacties = [...vandaagTxs]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        amount: Math.round(t.amount * 100) / 100,
        timestamp: t.timestamp,
        payment_type: t.payment_type,
        products: t.products?.map((p) => ({
          name: p.name,
          quantity: p.quantity,
        })),
      }));

    return NextResponse.json({
      omzetVandaag: Math.round(omzetVandaag * 100) / 100,
      aantalTransactiesVandaag: vandaagTxs.length,
      gemBonVandaag: Math.round(gemBonVandaag * 100) / 100,
      uurVerdeling,
      betaalmethoden,
      recenteTransacties,
      laatsteSale: laatste[0] ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
