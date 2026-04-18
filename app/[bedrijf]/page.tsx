import Link from "next/link";
import { notFound } from "next/navigation";
import { getDay } from "date-fns";
import PullToRefresh from "@/components/PullToRefresh";
import LiveRevenue from "@/components/LiveRevenue";
import RevenueChart from "@/components/RevenueChart";
import PeakHoursHeatmap from "@/components/PeakHoursHeatmap";
import WeekdagHeatmap from "@/components/WeekdagHeatmap";
import ProductsTable from "@/components/ProductsTable";
import Forecast from "@/components/Forecast";
import Schommelingen from "@/components/Schommelingen";
import OptimizatieSuggesties from "@/components/OptimizatieSuggesties";
import KerncijfersGrid from "@/components/KerncijfersGrid";
import JaarVergelijking from "@/components/JaarVergelijking";
import RecenteTransacties from "@/components/RecenteTransacties";
import { fetchAllTransactions, type Bedrijf } from "@/lib/sumup";
import { fetchAllZettlePurchases, normalizeZettleToSumUp } from "@/lib/zettle";
import { getZettleJaaroverzicht } from "@/lib/zettle-excel";
import HistorischOverzicht from "@/components/HistorischOverzicht";
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
  bb: { naam: "Brunch & Brew", emoji: "☕", hex: "#C8963E", slug: "bb" as Bedrijf },
  sl: { naam: "Saté Lounge",   emoji: "🍢", hex: "#E63946", slug: "sl" as Bedrijf },
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
  const jaaroverzicht = getZettleJaaroverzicht(config.slug);

  const [sumupResult, zettleResult] = await Promise.allSettled([
    fetchAllTransactions(config.slug),
    fetchAllZettlePurchases(config.slug),
  ]);

  const sumupTxs = sumupResult.status === "fulfilled" ? sumupResult.value : [];
  const zettleTxs =
    zettleResult.status === "fulfilled"
      ? normalizeZettleToSumUp(zettleResult.value)
      : [];

  const sumupFout =
    sumupResult.status === "rejected"
      ? (sumupResult.reason as Error).message
      : null;
  const zettleFout =
    zettleResult.status === "rejected"
      ? (zettleResult.reason as Error).message
      : null;

  // Combineer Zettle historie + SumUp actueel, ontdubbel op datum
  const sumupDatums = new Set(sumupTxs.map((tx) => tx.timestamp.slice(0, 10)));
  const zettleUniek = zettleTxs.filter(
    (tx) => !sumupDatums.has(tx.timestamp.slice(0, 10))
  );
  const alle = [...zettleUniek, ...sumupTxs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const heeftData = alle.length > 0;

  const dagOmzet        = heeftData ? berekenDagOmzet(alle)               : [];
  const piekuren        = heeftData ? berekenPiekuren(alle)               : [];
  const weekdagUurData  = heeftData ? berekenWeekdagUur(alle)             : [];
  const topProducten    = heeftData ? berekenTopProducten(alle)           : [];
  const maandOmzet      = heeftData ? berekenMaandOmzet(alle)             : [];
  const prognose        = heeftData ? berekenPrognose(alle)               : [];
  const schommelingen   = heeftData ? detecteerSchommelingen(dagOmzet)    : [];
  const kerncijfers     = heeftData ? berekenKerncijfers(alle)            : null;
  const weekdagCurve    = heeftData
    ? berekenWeekdagCurve(alle, getDay(new Date()))
    : new Array(24).fill(0);
  const suggesties      = heeftData && kerncijfers
    ? genereerSuggesties(piekuren, topProducten, prognose, kerncijfers)
    : [];

  const kleurNaam = config.slug === "bb" ? "bb-primary" : "sl-primary";

  return (
    <PullToRefresh>
      <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/30 hover:text-white/60 text-sm transition-colors"
            >
              ← Terug
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-2xl">{config.emoji}</span>
            <h1
              className="text-2xl font-bold"
              style={{ color: config.hex }}
            >
              {config.naam}
            </h1>
          </div>
          <div className="text-right">
            {heeftData && (
              <p className="text-white/50 text-sm tabular-nums">
                {alle.length.toLocaleString("nl-NL")} transacties totaal
              </p>
            )}
            <p className="text-white/30 text-[11px]">
              Data opgehaald: {fmtDatumTijd(opgehaald)}
            </p>
          </div>
        </div>

        {/* Fouten */}
        {(sumupFout || zettleFout) && (
          <div className="space-y-2 mb-4">
            {sumupFout && (
              <div className="card border-red-500/30 py-3">
                <p className="text-red-300 text-sm">
                  <strong>SumUp:</strong> {sumupFout}
                </p>
              </div>
            )}
            {zettleFout && (
              <div className="card border-yellow-500/20 py-3">
                <p className="text-yellow-300/80 text-xs">
                  Zettle API niet bereikbaar (historie uit Excel blijft werken):{" "}
                  {zettleFout}
                </p>
              </div>
            )}
          </div>
        )}

        {!heeftData ? (
          <div className="card text-center py-12">
            <p className="text-white/50 mb-2">
              Geen transactiedata beschikbaar.
            </p>
            <p className="text-white/30 text-sm">
              Controleer of de API keys correct zijn ingesteld in Vercel.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* LIVE sectie — vandaag in detail */}
            <LiveRevenue
              bedrijf={config.slug}
              kleur={kleurNaam}
              hex={config.hex}
              verwachtVandaag={kerncijfers?.verwachtVandaag ?? 0}
              weekdagCurve={weekdagCurve}
            />

            {/* KPI grid */}
            {kerncijfers && (
              <KerncijfersGrid kerncijfers={kerncijfers} hex={config.hex} />
            )}

            {/* Omzet per dag met range-selector */}
            {dagOmzet.length > 0 && (
              <RevenueChart
                data={dagOmzet}
                kleur={kleurNaam}
                hex={config.hex}
              />
            )}

            {/* Historisch jaaroverzicht uit Zettle Excel */}
            {jaaroverzicht.length > 0 && (
              <HistorischOverzicht
                data={jaaroverzicht}
                hex={config.hex}
                huidigJaar={new Date().getFullYear()}
                huidigJaarOmzet={kerncijfers?.ditJaar.omzet ?? 0}
              />
            )}

            {/* Maand-op-maand YoY */}
            {maandOmzet.length > 3 && (
              <JaarVergelijking data={maandOmzet} hex={config.hex} />
            )}

            {/* Weekdag × uur heatmap */}
            {weekdagUurData.length > 0 && (
              <WeekdagHeatmap data={weekdagUurData} hex={config.hex} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {piekuren.length > 0 && (
                <PeakHoursHeatmap data={piekuren} hex={config.hex} />
              )}
              <Schommelingen data={schommelingen} />
            </div>

            {/* Prognose met realisatie-indicator */}
            {prognose.length > 0 && kerncijfers && (
              <Forecast
                data={prognose}
                omzetVandaag={kerncijfers.vandaag.omzet}
              />
            )}

            {/* Producten */}
            {topProducten.length > 0 && (
              <ProductsTable data={topProducten} hex={config.hex} />
            )}

            {/* Recente transacties live feed */}
            <RecenteTransacties bedrijf={config.slug} hex={config.hex} />

            {/* Suggesties */}
            {suggesties.length > 0 && (
              <OptimizatieSuggesties suggesties={suggesties} />
            )}

            {/* Footer */}
            <div className="text-center text-white/20 text-xs pb-6 space-y-1">
              <p>
                {sumupTxs.length > 0 && `SumUp: ${sumupTxs.length} tx`}
                {zettleUniek.length > 0 &&
                  ` · Zettle API: ${zettleUniek.length} tx`}
                {jaaroverzicht.length > 0 &&
                  ` · Zettle Excel: ${jaaroverzicht.length} jaar`}
              </p>
              {dagOmzet.length > 0 && (
                <p>
                  Periode:{" "}
                  {new Date(alle[0].timestamp).toLocaleDateString("nl-NL")} –{" "}
                  {new Date(
                    alle[alle.length - 1].timestamp
                  ).toLocaleDateString("nl-NL")}{" "}
                  · {dagOmzet.length} dagen met omzet
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </PullToRefresh>
  );
}
