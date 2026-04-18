import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions, type Bedrijf } from "@/lib/sumup";
import {
  nlStartOfDayISO,
  nlEndOfDayISO,
  getHoursNL,
  nlDagKey,
} from "@/lib/tz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as Bedrijf;
  if (!["bb", "sl", "kl"].includes(bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  // Geef lege data terug als er geen key is (bijv. KL nog niet ingesteld)
  const keyMap: Record<Bedrijf, string | undefined> = {
    bb: process.env.SUMUP_KEY_BB,
    sl: process.env.SUMUP_KEY_SL,
    kl: process.env.SUMUP_KEY_KL,
  };
  if (!keyMap[bedrijf]) {
    return NextResponse.json({
      omzetVandaag: 0, aantalTransactiesVandaag: 0, gemBonVandaag: 0,
      uurVerdeling: [], betaalmethoden: {}, recenteTransacties: [],
      laatsteSale: null, timestamp: new Date().toISOString(), geenKey: true,
    });
  }

  try {
    const nu = new Date();
    const vandaagStart = nlStartOfDayISO(nu);
    const vandaagEind = nlEndOfDayISO(nu);

    // Extra marge rond de dag-grenzen omdat SumUp in UTC indexeert maar we
    // filteren op NL-dag; dit voorkomt dat een tx net voor middernacht NL
    // verloren gaat.
    const ruimOud = new Date(new Date(vandaagStart).getTime() - 3 * 3600_000).toISOString();
    const ruimNieuw = new Date(new Date(vandaagEind).getTime() + 3 * 3600_000).toISOString();

    const [laatste, ruweVandaagTxs] = await Promise.all([
      fetchTransactions(bedrijf, { limit: 1 }),
      fetchTransactions(bedrijf, {
        oldest_time: ruimOud,
        newest_time: ruimNieuw,
        limit: 250,
      }),
    ]);

    // Strikt filter op NL-kalenderdag
    const vandaagSleutel = nlDagKey(nu);
    const vandaagTxs = ruweVandaagTxs.filter(
      (t) => nlDagKey(t.timestamp) === vandaagSleutel
    );

    const omzetVandaag = vandaagTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const gemBonVandaag =
      vandaagTxs.length > 0 ? omzetVandaag / vandaagTxs.length : 0;

    // Uur-verdeling — gebaseerd op NL-uren
    const uurVerdeling = Array.from({ length: 24 }, (_, uur) => {
      const inUur = vandaagTxs.filter((t) => getHoursNL(t.timestamp) === uur);
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
