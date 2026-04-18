import Link from "next/link";
import { notFound } from "next/navigation";
import { getDay } from "date-fns";
import PullToRefresh from "@/components/PullToRefresh";
import BedrijfTabs from "@/components/BedrijfTabs";
import LiveRevenue from "@/components/LiveRevenue";
import RevenueChart from "@/components/RevenueChart";
import PeakHoursHeatmap from "@/components/PeakHoursHeatmap";
import WeekdagHeatmap from "@/components/WeekdagHeatmap";
import ProductsTable from "@/components/ProductsTable";
import ProductenLevenslang from "@/components/ProductenLevenslang";
import Forecast from "@/components/Forecast";
import Schommelingen from "@/components/Schommelingen";
import OptimizatieSuggesties from "@/components/OptimizatieSuggesties";
import KerncijfersGrid from "@/components/KerncijfersGrid";
import JaarVergelijking from "@/components/JaarVergelijking";
import RecenteTransacties from "@/components/RecenteTransacties";
import HistorischOverzicht from "@/components/HistorischOverzicht";
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
  berekenWeekdagUur,
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
    hex: "#00B8FF",         // neon blauw
    hexDark: "#0081B5",
    slug: "bb" as Bedrijf,
    paypalPeriode: "apr 2022 – nu",
  },
  sl: {
    naam: "Saté Lounge",
    emoji: "🍢",
    hex: "#00D27A",         // neon groen
    hexDark: "#008C52",
    slug: "sl" as Bedrijf,
    paypalPeriode: "apr 2023 – nu",
  },
};

type Params = { bedrijf: string };

function fmtDatumTijd(d: Date): string {
  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function DashboardPage({ params }: { params: Params }) {
  const config = BEDRIJVEN[params.bedrijf as keyof typeof BEDRIJVEN];
  if (!config) notFound();

  const opgehaald = new Date();

  // Historische data uit Excel — geen API calls nodig, snel en betrouwbaar
  const jaaroverzicht = getZettleJaaroverzicht(config.slug);
  const productLevens = getProductLevenshistorie(config.slug);

  // Alleen SumUp — Zettle API werkt niet, dus die slaan we over
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
  const weekdagUurData = heeftData ? berekenWeekdagUur(alle)          : [];
  const topProducten   = heeftData ? berekenTopProducten(alle)        : [];
  const maandOmzet     = heeftData ? berekenMaandOmzet(alle)          : [];
  const prognose       = heeftData ? berekenPrognose(alle)            : [];
  const schommelingen  = heeftData ? detecteerSchommelingen(dagOmzet) : [];
  const kerncijfers    = heeftData ? berekenKerncijfers(alle)         : null;
  const weekdagCurve   = heeftData
    ? berekenWeekdagCurve(alle, getDay(new Date()))
    : new Array(24).fill(0);
  const suggesties = heeftData && kerncijfers
    ? genereerSuggesties(piekuren, topProducten, prognose, kerncijfers)
    : [];

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

            {/* Historisch jaaroverzicht — alléén uit Excel */}
            {(jaaroverzicht.length > 0 || kerncijfers) && (
              <HistorischOverzicht
                data={jaaroverzicht}
                hex={config.hex}
                huidigJaar={new Date().getFullYear()}
                huidigJaarOmzet={kerncijfers?.ditJaar.omzet ?? 0}
                huidigJaarTx={kerncijfers?.ditJaar.txs ?? 0}
              />
            )}

            {maandOmzet.length > 3 && (
              <JaarVergelijking data={maandOmzet} hex={config.hex} />
            )}

            {weekdagUurData.length > 0 && (
              <WeekdagHeatmap data={weekdagUurData} hex={config.hex} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {piekuren.length > 0 && (
                <PeakHoursHeatmap data={piekuren} hex={config.hex} />
              )}
              <Schommelingen data={schommelingen} />
            </div>

            {prognose.length > 0 && kerncijfers && (
              <Forecast
                data={prognose}
                omzetVandaag={kerncijfers.vandaag.omzet}
              />
            )}

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

            {suggesties.length > 0 && (
              <OptimizatieSuggesties suggesties={suggesties} />
            )}

            <div className="text-center text-slate-300 text-xs pb-6 space-y-1">
              <p>
                SumUp: {sumupTxs.length.toLocaleString("nl-NL")} tx ·
                Zettle Excel: {jaaroverzicht.length} jaren ·
                Product Excel: {productLevens.length} items
              </p>
              {eersteDatum && laatsteDatum && (
                <p>
                  SumUp periode:{" "}
                  {eersteDatum.toLocaleDateString("nl-NL")} –{" "}
                  {laatsteDatum.toLocaleDateString("nl-NL")} ·{" "}
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
