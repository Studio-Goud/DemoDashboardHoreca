import { notFound } from "next/navigation";
import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import PullToRefresh from "@/components/PullToRefresh";
import BedrijfTabs from "@/components/BedrijfTabs";
import WelkomBanner from "@/components/WelkomBanner";
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
import CruiseAgenda from "@/components/CruiseAgenda";
import type { Bedrijf } from "@/lib/sumup";
import {
  getZettleJaaroverzicht,
  getProductLevenshistorie,
} from "@/lib/zettle-excel";
import { dashboardAggregaten } from "@/lib/dashboard-cache";

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

export default function DashboardPage({ params }: { params: Params }) {
  const config = BEDRIJVEN[params.bedrijf as keyof typeof BEDRIJVEN];
  if (!config) notFound();

  return (
    <PullToRefresh>
      <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <BedrijfTabs actief={config.slug} />
          <WelkomBanner />
        </div>

        <Suspense fallback={<DashboardSkeleton hex={config.hex} />}>
          <DashboardData config={config} />
        </Suspense>
      </main>
    </PullToRefresh>
  );
}

async function DashboardData({ config }: { config: BedrijfConfig }) {
  // Zware data + aggregaties komen uit de gedeelde server-cache (5 min TTL).
  // Eerste request per 5 min is traag; volgende requests instant.
  const [agg, jaaroverzicht, productLevens] = await Promise.all([
    dashboardAggregaten(config.slug),
    Promise.resolve(getZettleJaaroverzicht(config.slug)),
    Promise.resolve(getProductLevenshistorie(config.slug)),
  ]);

  const {
    sumupTxAantal,
    zettleTxAantal,
    sumupFout,
    zettleFout,
    dagOmzet,
    piekuren,
    topProducten,
    maandOmzet,
    prognose,
    schommelingen,
    kerncijfers,
    weekdagCurve,
    verrijkteEvents,
    cruiseDagen,
    suggesties,
    jaarTotalen: jaarTotalenAgg,
    gegenereerd,
    eersteDatum,
    laatsteDatum,
  } = agg;

  const heeftData = dagOmzet.length > 0;

  // Jaartotalen combineren: Excel historie + SumUp/Zettle aggregaat
  const jaarTotalenMap = new Map<number, { jaar: number; omzet: number; txs: number }>();
  for (const j of jaaroverzicht) {
    jaarTotalenMap.set(j.jaar, {
      jaar: j.jaar,
      omzet: j.omzetInclBtw,
      txs: j.aantalTransacties,
    });
  }
  for (const j of jaarTotalenAgg) {
    if (!jaarTotalenMap.has(j.jaar) || j.omzet > (jaarTotalenMap.get(j.jaar)?.omzet ?? 0)) {
      jaarTotalenMap.set(j.jaar, j);
    }
  }
  const jaarTotalen = Array.from(jaarTotalenMap.values()).sort(
    (a, b) => a.jaar - b.jaar
  );

  const cruiseHints = cruiseDagen.map((d) => ({
    datum: d.datum,
    totaalPassagiers: d.totaalPassagiers,
    aantal: d.cruises.length,
  }));
  const kleurNaam = config.slug === "bb" ? "bb-primary" : "sl-primary";
  const opgehaald = parseISO(gegenereerd);

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
          {sumupTxAantal.toLocaleString("nl-NL")} SumUp tx ·{" "}
          {zettleTxAantal.toLocaleString("nl-NL")} Zettle tx ·{" "}
          {jaaroverzicht.length} Zettle jaaroverzichten ·{" "}
          {productLevens.length} producten · data van {fmtDatumTijd(opgehaald)}
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
          SumUp: {sumupTxAantal.toLocaleString("nl-NL")} tx · Zettle API:{" "}
          {zettleTxAantal.toLocaleString("nl-NL")} tx · Zettle Excel:{" "}
          {jaaroverzicht.length} jaren · Product Excel:{" "}
          {productLevens.length} items
        </p>
        {eersteDatum && laatsteDatum && (
          <p>
            Periode vanaf 2023-01-01:{" "}
            {format(parseISO(eersteDatum), "dd-MM-yyyy", { locale: nl })} –{" "}
            {format(parseISO(laatsteDatum), "dd-MM-yyyy", { locale: nl })} ·{" "}
            {dagOmzet.length} dagen met omzet
          </p>
        )}
      </div>
    </div>
  );
}
