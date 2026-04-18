import { unstable_cache } from "next/cache";
import { getDay } from "date-fns";
import { fetchAllTransactions, type Bedrijf } from "./sumup";
import { fetchAllZettlePurchases, normalizeZettleToSumUp } from "./zettle";
import {
  berekenDagOmzet,
  berekenPiekuren,
  berekenTopProducten,
  berekenPrognose,
  detecteerSchommelingen,
  berekenKerncijfers,
  berekenMaandOmzet,
  berekenWeekdagCurve,
  verrijkEvents,
  genereerSuggesties,
  berekenProductCombinaties,
  type DagOmzet,
  type UurData,
  type ProductData,
  type ProductCombi,
  type MaandOmzet,
  type Prognose,
  type Schommeling,
  type KernCijfers,
  type Suggestie,
  type VerrijktEvent,
} from "./analytics";
import { komendeEvents } from "./feestdagen";
import { komendeCruises, type CruiseDag } from "./cruises";

export interface DashboardAggregaten {
  sumupTxAantal: number;
  zettleTxAantal: number;
  eersteDatum: string | null;
  laatsteDatum: string | null;
  sumupFout: string | null;
  zettleFout: string | null;

  dagOmzet: DagOmzet[];
  piekuren: UurData[];
  topProducten: ProductData[];
  productCombinaties: ProductCombi[];
  maandOmzet: MaandOmzet[];
  prognose: Prognose[];
  schommelingen: Schommeling[];
  kerncijfers: KernCijfers | null;
  weekdagCurve: number[];
  verrijkteEvents: VerrijktEvent[];
  cruiseDagen: CruiseDag[];
  suggesties: Suggestie[];

  jaarTotalen: { jaar: number; omzet: number; txs: number }[];
  gegenereerd: string;
}

async function berekenDashboardAggregaten(
  bedrijf: Bedrijf
): Promise<DashboardAggregaten> {
  const [sumupResult, zettleResult] = await Promise.allSettled([
    fetchAllTransactions(bedrijf),
    fetchAllZettlePurchases(bedrijf),
  ]);

  const sumupTxs = sumupResult.status === "fulfilled" ? sumupResult.value : [];
  const sumupFout =
    sumupResult.status === "rejected"
      ? (sumupResult.reason as Error).message
      : null;

  const zettleTxs =
    zettleResult.status === "fulfilled"
      ? normalizeZettleToSumUp(zettleResult.value)
      : [];
  const zettleFout =
    zettleResult.status === "rejected"
      ? (zettleResult.reason as Error).message
      : null;

  // Dedup op timestamp+amount (overlap migratie-moment Zettle↔SumUp)
  const sumupSleutels = new Set(
    sumupTxs.map(
      (tx) => `${tx.timestamp.slice(0, 19)}|${tx.amount.toFixed(2)}`
    )
  );
  const zettleUniek = zettleTxs.filter(
    (tx) =>
      !sumupSleutels.has(
        `${tx.timestamp.slice(0, 19)}|${tx.amount.toFixed(2)}`
      )
  );
  const alle = [...zettleUniek, ...sumupTxs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const heeftData = alle.length > 0;

  const dagOmzet       = heeftData ? berekenDagOmzet(alle)                       : [];
  const piekuren       = heeftData ? berekenPiekuren(alle)                       : [];
  const topProducten   = heeftData ? berekenTopProducten(alle)                   : [];
  const productCombinaties = heeftData ? berekenProductCombinaties(alle)         : [];
  const maandOmzet     = heeftData ? berekenMaandOmzet(alle)                     : [];
  const prognose       = heeftData ? berekenPrognose(alle, bedrijf)              : [];
  const schommelingen  = heeftData ? detecteerSchommelingen(dagOmzet)            : [];
  const kerncijfers    = heeftData ? berekenKerncijfers(alle)                    : null;
  const weekdagCurve   = heeftData
    ? berekenWeekdagCurve(alle, getDay(new Date()))
    : new Array<number>(24).fill(0);
  const verrijkteEvents = verrijkEvents(komendeEvents(90), alle, bedrijf);
  const cruiseDagen = komendeCruises(14);

  const suggesties =
    heeftData && kerncijfers
      ? genereerSuggesties(
          piekuren,
          topProducten,
          prognose,
          kerncijfers,
          schommelingen,
          cruiseDagen.map((d) => ({
            datum: d.datum,
            totaalPassagiers: d.totaalPassagiers,
            aantal: d.cruises.length,
            dagenVanNu: d.dagenVanNu,
          }))
        )
      : [];

  const huidigJaar = new Date().getFullYear();
  const jaarTotalen: { jaar: number; omzet: number; txs: number }[] = [];
  const perJaar = new Map<number, { omzet: number; txs: number }>();
  for (const m of maandOmzet) {
    const cur = perJaar.get(m.jaar) ?? { omzet: 0, txs: 0 };
    cur.omzet += m.omzet;
    cur.txs += m.txs;
    perJaar.set(m.jaar, cur);
  }
  for (const [jaar, v] of Array.from(perJaar.entries())) {
    jaarTotalen.push({
      jaar,
      omzet: Math.round(v.omzet * 100) / 100,
      txs: v.txs,
    });
  }
  jaarTotalen.sort((a, b) => a.jaar - b.jaar);

  return {
    sumupTxAantal: sumupTxs.length,
    zettleTxAantal: zettleUniek.length,
    eersteDatum: dagOmzet[0]?.datum ?? null,
    laatsteDatum: dagOmzet[dagOmzet.length - 1]?.datum ?? null,
    sumupFout,
    zettleFout,
    dagOmzet,
    piekuren,
    topProducten,
    productCombinaties,
    maandOmzet,
    prognose,
    schommelingen,
    kerncijfers,
    weekdagCurve,
    verrijkteEvents,
    cruiseDagen,
    suggesties,
    jaarTotalen,
    gegenereerd: new Date().toISOString(),
  };
}

// Cachet het volledig uitgerekende dashboard voor 5 minuten. Eerste
// request per 5min is traag (volledige aggregatie op 180k tx), daarna
// serveert Vercel direct uit de data-cache. De onderliggende Zettle/
// SumUp fetches zijn zelf ook gecached (24u/60s), dus realistisch: eens
// per 5 minuten wat rekenwerk, verder instant.
export const dashboardAggregaten = unstable_cache(
  berekenDashboardAggregaten,
  ["dashboard-aggregaten-v2"],
  { revalidate: 300, tags: ["dashboard"] }
);
