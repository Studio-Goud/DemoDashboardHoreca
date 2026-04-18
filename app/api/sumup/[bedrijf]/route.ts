import { NextRequest, NextResponse } from "next/server";
import { fetchTransactions, fetchAllTransactions, type Bedrijf } from "@/lib/sumup";
import {
  berekenDagOmzet,
  berekenPiekuren,
  berekenTopProducten,
  berekenPrognose,
  detecteerSchommelingen,
  genereerSuggesties,
} from "@/lib/analytics";
import { format, startOfDay, endOfDay } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as Bedrijf;
  if (!["bb", "sl"].includes(bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "dashboard";

  try {
    if (type === "live") {
      // Laatste transactie + omzet van vandaag
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
      const aantalVandaag = vandaagTxs.length;

      return NextResponse.json({
        omzetVandaag: Math.round(omzetVandaag * 100) / 100,
        aantalTransactiesVandaag: aantalVandaag,
        laasteSale: laatste[0] ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    if (type === "dashboard") {
      // Volledige geschiedenis ophalen voor analyses
      const alle = await fetchAllTransactions(bedrijf);

      const dagOmzet = berekenDagOmzet(alle);
      const piekuren = berekenPiekuren(alle);
      const topProducten = berekenTopProducten(alle);
      const prognose = berekenPrognose(alle);
      const schommelingen = detecteerSchommelingen(dagOmzet);
      const suggesties = genereerSuggesties(piekuren, topProducten, prognose);

      return NextResponse.json({
        dagOmzet,
        piekuren,
        topProducten,
        prognose,
        schommelingen,
        suggesties,
        totaalTransacties: alle.length,
        periodeVan: alle.length > 0 ? alle[alle.length - 1].timestamp : null,
        periodeTot: alle.length > 0 ? alle[0].timestamp : null,
      });
    }

    return NextResponse.json({ error: "Onbekend type" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
