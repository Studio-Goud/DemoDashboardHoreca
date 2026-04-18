import Link from "next/link";
import { notFound } from "next/navigation";
import PullToRefresh from "@/components/PullToRefresh";
import LiveRevenue from "@/components/LiveRevenue";
import RevenueChart from "@/components/RevenueChart";
import PeakHoursHeatmap from "@/components/PeakHoursHeatmap";
import ProductsTable from "@/components/ProductsTable";
import Forecast from "@/components/Forecast";
import Schommelingen from "@/components/Schommelingen";
import OptimizatieSuggesties from "@/components/OptimizatieSuggesties";
import { fetchAllTransactions, type Bedrijf } from "@/lib/sumup";
import { fetchAllZettlePurchases, normalizeZettleToSumUp } from "@/lib/zettle";
import {
  berekenDagOmzet,
  berekenPiekuren,
  berekenTopProducten,
  berekenPrognose,
  detecteerSchommelingen,
  genereerSuggesties,
} from "@/lib/analytics";

// Pagina wordt elke 5 minuten opnieuw gegenereerd op Vercel
export const revalidate = 300;

const BEDRIJVEN = {
  bb: { naam: "Brunch & Brew", emoji: "☕", hex: "#C8963E", slug: "bb" as Bedrijf },
  sl: { naam: "Saté Lounge",   emoji: "🍢", hex: "#E63946", slug: "sl" as Bedrijf },
};

type Params = { bedrijf: string };

export default async function DashboardPage({ params }: { params: Params }) {
  const config = BEDRIJVEN[params.bedrijf as keyof typeof BEDRIJVEN];
  if (!config) notFound();

  // Haal SumUp en Zettle parallel op — als één faalt gaat de rest gewoon door
  const [sumupResult, zettleResult] = await Promise.allSettled([
    fetchAllTransactions(config.slug),
    fetchAllZettlePurchases(config.slug),
  ]);

  const sumupTxs = sumupResult.status === "fulfilled" ? sumupResult.value : [];
  const zettleTxs =
    zettleResult.status === "fulfilled"
      ? normalizeZettleToSumUp(zettleResult.value)
      : [];

  const sumupFout = sumupResult.status === "rejected"
    ? (sumupResult.reason as Error).message
    : null;
  const zettleFout = zettleResult.status === "rejected"
    ? (zettleResult.reason as Error).message
    : null;

  // Combineer: Zettle historisch + SumUp actueel, dedupliceer op datum
  const sumupDatums = new Set(sumupTxs.map((tx) => tx.timestamp.slice(0, 10)));
  const zettleUniek = zettleTxs.filter(
    (tx) => !sumupDatums.has(tx.timestamp.slice(0, 10))
  );
  const alle = [...zettleUniek, ...sumupTxs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const heeftData = alle.length > 0;

  const dagOmzet     = heeftData ? berekenDagOmzet(alle)         : [];
  const piekuren     = heeftData ? berekenPiekuren(alle)          : [];
  const topProducten = heeftData ? berekenTopProducten(alle)      : [];
  const prognose     = heeftData ? berekenPrognose(alle)          : [];
  const schommelingen = heeftData ? detecteerSchommelingen(dagOmzet) : [];
  const suggesties   = heeftData
    ? genereerSuggesties(piekuren, topProducten, prognose)
    : [];

  return (
    <PullToRefresh>
      <main className="min-h-screen p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
              ← Terug
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-2xl">{config.emoji}</span>
            <h1 className="text-2xl font-bold" style={{ color: config.hex }}>
              {config.naam}
            </h1>
          </div>
          {heeftData && (
            <p className="text-white/30 text-sm">
              {alle.length.toLocaleString("nl-NL")} transacties totaal
            </p>
          )}
        </div>

        {/* API fouten tonen */}
        {(sumupFout || zettleFout) && (
          <div className="card border-red-500/20 mb-6 space-y-1">
            {sumupFout && <p className="text-red-400 text-sm">SumUp: {sumupFout}</p>}
            {zettleFout && <p className="text-orange-400 text-sm">Zettle: {zettleFout}</p>}
          </div>
        )}

        {!heeftData ? (
          <div className="card text-center py-12">
            <p className="text-white/50 mb-2">Geen transactiedata beschikbaar.</p>
            <p className="text-white/30 text-sm">
              Controleer of de API keys correct zijn ingesteld in Vercel.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live omzet — client component, ververst elke 30s */}
            <LiveRevenue bedrijf={config.slug} kleur={config.slug === "bb" ? "bb-primary" : "sl-primary"} />

            {dagOmzet.length > 0 && (
              <RevenueChart data={dagOmzet} kleur={config.slug === "bb" ? "bb-primary" : "sl-primary"} hex={config.hex} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {piekuren.length > 0 && <PeakHoursHeatmap data={piekuren} hex={config.hex} />}
              <Schommelingen data={schommelingen} />
            </div>

            {topProducten.length > 0 && (
              <ProductsTable data={topProducten} hex={config.hex} />
            )}

            {prognose.length > 0 && <Forecast data={prognose} />}

            {suggesties.length > 0 && <OptimizatieSuggesties suggesties={suggesties} />}

            {/* Footer */}
            <div className="text-center text-white/20 text-xs pb-6 space-y-1">
              <p>
                {sumupTxs.length > 0 && `SumUp: ${sumupTxs.length} tx`}
                {zettleUniek.length > 0 && ` · Zettle: ${zettleUniek.length} tx`}
              </p>
              {dagOmzet.length > 0 && (
                <p>
                  Periode: {new Date(alle[0].timestamp).toLocaleDateString("nl-NL")} –{" "}
                  {new Date(alle[alle.length - 1].timestamp).toLocaleDateString("nl-NL")}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </PullToRefresh>
  );
}
