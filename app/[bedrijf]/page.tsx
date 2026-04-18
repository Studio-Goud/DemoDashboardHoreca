import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDay, format } from "date-fns";
import { nl } from "date-fns/locale";
import PullToRefresh from "@/components/PullToRefresh";
import BedrijfTabs from "@/components/BedrijfTabs";
import DashboardSkeleton from "@/components/DashboardSkeleton";
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
  fetchAllZettlePurchases,
  normalizeZettleToSumUp,
} from "@/lib/zettle";
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
  verrijkEvents,
} from "@/lib/analytics";
import { komendeEvents } from "@/lib/feestdagen";
import { komendeCruises } from "@/lib/cruises";
import CruiseAgenda from "@/components/CruiseAgenda";

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
type BedrijfConfig = (typeof BEDRIJVEN)[keyof typeof BEDRIJVEN];

function fmtDatumTijd(d: Date): string {
  return format(d, "dd-MM-yyyy HH:mm:ss", { locale: nl });
}

// ---------------------------------------------------------------------------
// Shell — rendert direct. Data binnenin streamt via Suspense.
// ---------------------------------------------------------------------------

export default function DashboardPage({ params }: { params: Params }) {
  const config = BEDRIJVEN[params.bedrijf as keyof typeof BEDRIJVEN];
  if (!config) notFound();

  return (
    <PullToRefresh>
      <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header met tab-switcher — direct zichtbaar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <BedrijfTabs actief={config.slug} />
        </div>

        <Suspense fallback={<DashboardSkeleton hex={config.hex} />}>
          <DashboardData config={config} />
        </Suspense>
      </main>
    </PullToRefresh>
  );
}

// ---------------------------------------------------------------------------
// Data section — async, streamt in zodra SumUp klaar is.
// ---------------------------------------------------------------------------

async function DashboardData({ config }: { config: BedrijfConfig }) {
  const opgehaald = new Date();

  const jaaroverzicht = getZettleJaaroverzicht(config.slug);
  const productLevens = getProductLevenshistorie(config.slug);

  const [sumupResult, zettleResult] = await Promise.allSettled([
    fetchAllTransactions(config.slug),
    fetchAllZettlePurchases(config.slug),
  ]);

  const sumupTxs =
    sumupResult.status === "fulfilled" ? sumupResult.value : [];
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

  // Combineer Zettle historie + SumUp actueel, ontdubbel op timestamp-amount.
  // Zettle heeft de volledige historie, SumUp de meest recente live data.
  // Bij overlap (migratie-moment) kunnen beide dezelfde tx bevatten, dus
  // we ontdubbelen. SumUp wint bij overlap omdat die actueler is.
  const sumupSleutels = new Set(
    sumupTxs.map((tx) => `${tx.timestamp.slice(0, 19)}|${tx.amount.toFixed(2)}`)
  );
  const zettleUniek = zettleTxs.filter(
    (tx) => !sumupSleutels.has(`${tx.timestamp.slice(0, 19)}|${tx.amount.toFixed(2)}`)
  );
  const alle = [...zettleUniek, ...sumupTxs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const heeftData = alle.length > 0;

  const dagOmzet       = heeftData ? berekenDagOmzet(alle)                       : [];
  const piekuren       = heeftData ? berekenPiekuren(alle)                       : [];
  const topProducten   = heeftData ? berekenTopProducten(alle)                   : [];
  const maandOmzet     = heeftData ? berekenMaandOmzet(alle)                     : [];
  const prognose       = heeftData ? berekenPrognose(alle, config.slug)          : [];
  const schommelingen  = heeftData ? detecteerSchommelingen(dagOmzet)            : [];
  const kerncijfers    = heeftData ? berekenKerncijfers(alle)                    : null;
  const verrijkteEvents = verrijkEvents(komendeEvents(90), alle, config.slug);
  const cruiseDagen = komendeCruises(14);
  const cruiseHints = cruiseDagen.map((d) => ({
    datum: d.datum,
    totaalPassagiers: d.totaalPassagiers,
    aantal: d.cruises.length,
  }));
  const weekdagCurve   = heeftData
    ? berekenWeekdagCurve(alle, getDay(new Date()))
    : new Array(24).fill(0);
  const cruiseSuggestieHints = cruiseDagen.map((d) => ({
    datum: d.datum,
    totaalPassagiers: d.totaalPassagiers,
    aantal: d.cruises.length,
    dagenVanNu: d.dagenVanNu,
  }));
  const suggesties =
    heeftData && kerncijfers
      ? genereerSuggesties(
          piekuren,
          topProducten,
          prognose,
          kerncijfers,
          schommelingen,
          cruiseSuggestieHints
        )
      : [];

  // Jaartotalen voor Vergelijken
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

  if (!heeftData && jaaroverzicht.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-500 mb-2">
          Geen transactiedata beschikbaar.
        </p>
        <p className="text-slate-400 text-sm">
          Controleer SumUp API keys in Vercel environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sumupFout && (
        <div className="card border-red-500/30 py-3">
          <p className="text-red-600 text-sm">
            <strong>SumUp:</strong> {sumupFout}
          </p>
        </div>
      )}
      {zettleFout && (
        <div className="card border-amber-300 py-3">
          <p className="text-amber-700 text-sm">
            <strong>Zettle historie:</strong> {zettleFout}
          </p>
          <p className="text-amber-700/80 text-[11px] mt-1">
            App werkt door met alleen SumUp-data. Zet ZETTLE_CLIENT_ID_* en
            ZETTLE_TOKEN_* in Vercel environment variables.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <p className="text-slate-400 text-[11px]">
          {sumupTxs.length.toLocaleString("nl-NL")} SumUp tx ·{" "}
          {zettleUniek.length.toLocaleString("nl-NL")} Zettle tx ·{" "}
          {jaaroverzicht.length} Zettle jaaroverzichten ·{" "}
          {productLevens.length} producten · {fmtDatumTijd(opgehaald)}
        </p>
      </div>

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
        <RevenueChart data={dagOmzet} kleur={kleurNaam} hex={config.hex} />
      )}

      {dagOmzet.length > 0 && (
        <Vergelijken
          dagOmzet={dagOmzet}
          maandOmzet={maandOmzet}
          jaarTotalen={jaarTotalen}
          hex={config.hex}
        />
      )}

      <FeestdagenKalender events={verrijkteEvents} bedrijf={config.slug} />

      <CruiseAgenda dagen={cruiseDagen} />

      {suggesties.length > 0 && (
        <OptimizatieSuggesties suggesties={suggesties} />
      )}

      {prognose.length > 0 && kerncijfers && (
        <Forecast
          data={prognose}
          omzetVandaag={kerncijfers.vandaag.omzet}
          bedrijf={config.slug}
          cruises={cruiseHints}
        />
      )}

      <Schommelingen data={schommelingen} />

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
          SumUp: {sumupTxs.length.toLocaleString("nl-NL")} tx · Zettle API:{" "}
          {zettleUniek.length.toLocaleString("nl-NL")} tx · Zettle Excel:{" "}
          {jaaroverzicht.length} jaren · Product Excel:{" "}
          {productLevens.length} items
        </p>
        {eersteDatum && laatsteDatum && (
          <p>
            Periode:{" "}
            {format(eersteDatum, "dd-MM-yyyy", { locale: nl })} –{" "}
            {format(laatsteDatum, "dd-MM-yyyy", { locale: nl })} ·{" "}
            {dagOmzet.length} dagen met omzet
          </p>
        )}
      </div>
    </div>
  );
}
