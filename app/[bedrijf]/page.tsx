import { notFound } from "next/navigation";
import { getDay, format } from "date-fns";
import { nl } from "date-fns/locale";
import PullToRefresh from "@/components/PullToRefresh";
import BedrijfTabs from "@/components/BedrijfTabs";
import LiveRevenue from "@/components/LiveRevenue";
import RevenueChart from "@/components/RevenueChart";
import ProductsTable from "@/components/ProductsTable";
import ProductenLevenslang from "@/components/ProductenLevenslang";
import Forecast from "@/components/Forecast";
import Schommelingen from "@/components/Schommelingen";
import OptimizatieSuggesties from "@/components/OptimizatieSuggesties";
import KerncijfersGrid from "@/components/KerncijfersGrid";
import RecenteTransacties from "@/components/RecenteTransacties";
import FeestdagenKalender from "@/components/FeestdagenKalender";
import Vergelijken from "@/components/Vergelijken";
import { fetchAllTransactions, type Bedrijf } from "@/lib/sumup";
import {
  getZettleJaaroverzicht,
  getProductLevenshistorie,
} from "@/lib/zettle-excel";
import {
  berekenDagOmzet,
  berekenPiekuren,
  berekenTopProducten,
  berekenPrognose,
  detecteerSchommelingen,
  genereerSuggesties,
  berekenKerncijfers,
  berekenMaandOmzet,
  berekenWeekdagCurve,
} from "@/lib/analytics";

// Altijd verse data — geen cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BEDRIJVEN = {
  bb: {
    naam: "Brunch & Brew",
    emoji: "☕",
    hex: "#00B8FF",
    slug: "bb" as Bedrijf,
    paypalPeriode: "apr 2022 – nu",
  },
  sl: {
    naam: "Saté Lounge",
    emoji: "🍢",
    hex: "#00D27A",
    slug: "sl" as Bedrijf,
    paypalPeriode: "apr 2023 – nu",
  },
};

type Params = { bedrijf: string };

function fmtDatumTijd(d: Date): string {
  return format(d, "dd-MM-yyyy HH:mm:ss", { locale: nl });
}

export default async function DashboardPage({ params }: { params: Params }) {
  const config = BEDRIJVEN[params.bedrijf as keyof typeof BEDRIJVEN];
  if (!config) notFound();

  const opgehaald = new Date();

  const jaaroverzicht = getZettleJaaroverzicht(config.slug);
  const productLevens = getProductLevenshistorie(config.slug);

  const sumupResult = await Promise.allSettled([
    fetchAllTransactions(config.slug),
  ]);

  const sumupTxs =
    sumupResult[0].status === "fulfilled" ? sumupResult[0].value : [];
  const sumupFout =
    sumupResult[0].status === "rejected"
      ? (sumupResult[0].reason as Error).message
      : null;

  const alle = [...sumupTxs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const heeftData = alle.length > 0;

  const dagOmzet       = heeftData ? berekenDagOmzet(alle)            : [];
  const piekuren       = heeftData ? berekenPiekuren(alle)            : [];
  const topProducten   = heeftData ? berekenTopProducten(alle)        : [];
  const maandOmzet     = heeftData ? berekenMaandOmzet(alle)          : [];
  const prognose       = heeftData ? berekenPrognose(alle)            : [];
  const schommelingen  = heeftData ? detecteerSchommelingen(dagOmzet) : [];
  const kerncijfers    = heeftData ? berekenKerncijfers(alle)         : null;
  const weekdagCurve   = heeftData
    ? berekenWeekdagCurve(alle, getDay(new Date()))
    : new Array(24).fill(0);
  const suggesties =
    heeftData && kerncijfers
      ? genereerSuggesties(
          piekuren,
          topProducten,
          prognose,
          kerncijfers,
          schommelingen
        )
      : [];

  // Jaartotalen voor Vergelijken: combineer Zettle historisch + huidig SumUp jaar
  const huidigJaar = new Date().getFullYear();
  const jaarTotalen = [
    ...jaaroverzicht.map((j) => ({
      jaar: j.jaar,
      omzet: j.omzetInclBtw,
      txs: j.aantalTransacties,
    })),
  ];
  if (kerncijfers && !jaarTotalen.some((j) => j.jaar === huidigJaar)) {
    jaarTotalen.push({
      jaar: huidigJaar,
      omzet: kerncijfers.ditJaar.omzet,
      txs: kerncijfers.ditJaar.txs,
    });
  }

  const kleurNaam = config.slug === "bb" ? "bb-primary" : "sl-primary";

  const eersteDatum =
    dagOmzet.length > 0 ? new Date(dagOmzet[0].datum) : null;
  const laatsteDatum =
    dagOmzet.length > 0
      ? new Date(dagOmzet[dagOmzet.length - 1].datum)
      : null;

  return (
    <PullToRefresh>
      <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header met tab-switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <BedrijfTabs actief={config.slug} />
          <div className="text-right">
            <p className="text-slate-500 text-sm tabular-nums">
              {alle.length.toLocaleString("nl-NL")} SumUp tx ·{" "}
              {jaaroverzicht.length} Zettle jaren ·{" "}
              {productLevens.length} producten (historisch)
            </p>
            <p className="text-slate-400 text-[11px]">
              Data opgehaald: {fmtDatumTijd(opgehaald)}
            </p>
          </div>
        </div>

        {sumupFout && (
          <div className="card border-red-500/30 mb-4 py-3">
            <p className="text-red-600 text-sm">
              <strong>SumUp:</strong> {sumupFout}
            </p>
          </div>
        )}

        {!heeftData && jaaroverzicht.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-500 mb-2">
              Geen transactiedata beschikbaar.
            </p>
            <p className="text-slate-400 text-sm">
              Controleer SumUp API keys in Vercel environment variables.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {heeftData && (
              <LiveRevenue
                bedrijf={config.slug}
                kleur={kleurNaam}
                hex={config.hex}
                verwachtVandaag={kerncijfers?.verwachtVandaag ?? 0}
                weekdagCurve={weekdagCurve}
              />
            )}

            {kerncijfers && (
              <KerncijfersGrid kerncijfers={kerncijfers} hex={config.hex} />
            )}

            {dagOmzet.length > 0 && (
              <RevenueChart
                data={dagOmzet}
                kleur={kleurNaam}
                hex={config.hex}
              />
            )}

            {/* Vergelijken: dag / maand / jaar / seizoen */}
            {dagOmzet.length > 0 && (
              <Vergelijken
                dagOmzet={dagOmzet}
                maandOmzet={maandOmzet}
                jaarTotalen={jaarTotalen}
                hex={config.hex}
              />
            )}

            {/* Feestdagen + vakanties agenda */}
            <FeestdagenKalender />

            {/* Signalen & suggesties */}
            {suggesties.length > 0 && (
              <OptimizatieSuggesties suggesties={suggesties} />
            )}

            {/* Prognose */}
            {prognose.length > 0 && kerncijfers && (
              <Forecast
                data={prognose}
                omzetVandaag={kerncijfers.vandaag.omzet}
              />
            )}

            {/* Schommelingen */}
            <Schommelingen data={schommelingen} />

            {/* Producten */}
            {topProducten.length > 0 && (
              <ProductsTable data={topProducten} hex={config.hex} />
            )}

            {productLevens.length > 0 && (
              <ProductenLevenslang
                data={productLevens}
                hex={config.hex}
                periodeLabel={config.paypalPeriode}
              />
            )}

            {heeftData && (
              <RecenteTransacties bedrijf={config.slug} hex={config.hex} />
            )}

            <div className="text-center text-slate-300 text-xs pb-6 space-y-1">
              <p>
                SumUp: {sumupTxs.length.toLocaleString("nl-NL")} tx · Zettle
                Excel: {jaaroverzicht.length} jaren · Product Excel:{" "}
                {productLevens.length} items
              </p>
              {eersteDatum && laatsteDatum && (
                <p>
                  SumUp periode:{" "}
                  {format(eersteDatum, "dd-MM-yyyy", { locale: nl })} –{" "}
                  {format(laatsteDatum, "dd-MM-yyyy", { locale: nl })} ·{" "}
                  {dagOmzet.length} dagen met omzet
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </PullToRefresh>
  );
}
