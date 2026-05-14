import { notFound } from "next/navigation";
import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import PullToRefresh from "@/components/PullToRefresh";
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
import WeerImpact from "@/components/WeerImpact";
import ProductCombinaties from "@/components/ProductCombinaties";
import BezettingAdvies from "@/components/BezettingAdvies";
import DashboardNav from "@/components/DashboardNav";
import type { Bedrijf } from "@/lib/sumup";
import {
  getZettleJaaroverzicht,
  getProductLevenshistorie,
} from "@/lib/zettle-excel";
import { dashboardAggregaten } from "@/lib/dashboard-cache";
import { getWeer, weerInfo } from "@/lib/weer";
import { dienstenVandaag, bezettingKomendePeriode } from "@/lib/rooster";
import RoosterVandaag from "@/components/RoosterVandaag";
import RoosterWeek from "@/components/RoosterWeek";
import ManagerWidgets from "@/components/ManagerWidgets";
import VoorraadAlerts from "@/components/VoorraadAlerts";
import AdminTab from "@/components/administratie/AdminTab";
import SalarisPanel from "@/components/administratie/SalarisPanel";
import BedrijfsInstellingen from "@/components/administratie/BedrijfsInstellingen";
import InleenDoorberekening from "@/components/administratie/InleenDoorberekening";
import VoorraadAfrekening from "@/components/administratie/VoorraadAfrekening";
import PersoneelPrestaties from "@/components/administratie/PersoneelPrestaties";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BEDRIJVEN = {
  bb: {
    naam: "Brunch & Brew",
    hex: "#0A84FF",
    slug: "bb" as Bedrijf,
    paypalPeriode: "apr 2022 – nu",
  },
  sl: {
    naam: "Saté Lounge",
    hex: "#30B26F",
    slug: "sl" as Bedrijf,
    paypalPeriode: "apr 2023 – nu",
  },
  kl: {
    naam: "Het Kroket Loket",
    hex: "#E07A1F",
    slug: "kl" as Bedrijf,
    paypalPeriode: "historie nog niet beschikbaar",
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
  const [agg, jaaroverzicht, productLevens, weerData, diensten, weekRooster] = await Promise.all([
    dashboardAggregaten(config.slug),
    Promise.resolve(getZettleJaaroverzicht(config.slug)),
    Promise.resolve(getProductLevenshistorie(config.slug)),
    getWeer().catch(() => []),
    dienstenVandaag(config.slug).catch((e) => {
      console.error("Shiftbase vandaag fout:", e);
      return [] as Awaited<ReturnType<typeof dienstenVandaag>>;
    }),
    bezettingKomendePeriode(config.slug, 7).catch((e) => {
      console.error("Shiftbase week fout:", e);
      return [] as Awaited<ReturnType<typeof bezettingKomendePeriode>>;
    }),
  ]);

  // Aantal unieke mensen gepland vandaag op dit bedrijf
  const bezVandaag = diensten.length > 0
    ? new Set(diensten.map((d) => d.medewerker.id)).size
    : null;

  const {
    sumupTxAantal,
    zettleTxAantal,
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
    jaarTotalen: jaarTotalenAgg,
    gegenereerd,
    eersteDatum,
    laatsteDatum,
  } = agg;

  const weerHints = weerData.map((w) => {
    const info = weerInfo(w.weerCode);
    return {
      datum: w.datum,
      tempMax: w.tempMax,
      tempMin: w.tempMin,
      neerslag: w.neerslag,
      emoji: info.emoji,
      categorie: info.categorie,
    };
  });

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
  const kleurNaam =
    config.slug === "bb"
      ? "bb-primary"
      : config.slug === "sl"
      ? "sl-primary"
      : "kl-primary";
  const opgehaald = parseISO(gegenereerd);

  if (!heeftData && jaaroverzicht.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card text-center py-12">
          <p className="text-slate-500 mb-2">
            Geen transactiedata beschikbaar.
          </p>
          <p className="text-slate-400 text-sm">
            {sumupFout || zettleFout
              ? "Tijdelijke fout bij ophalen — probeer opnieuw over een paar minuten."
              : "Controleer SumUp/Zettle API keys in Vercel environment variables."}
          </p>
          {sumupFout && (
            <p className="text-red-500 text-xs mt-3 font-mono">
              SumUp: {sumupFout}
            </p>
          )}
          {zettleFout && (
            <p className="text-red-500 text-xs mt-1 font-mono">
              Zettle: {zettleFout}
            </p>
          )}
        </div>
      </div>
    );
  }

  // labels worden vertaald in DashboardNav via t(`tab.${id}`)
  const TABS = [
    { id: "omzet",     label: "Omzet",         icon: "trending-up" as const, tKey: "tab.revenue"  },
    { id: "planning",  label: "Planning",      icon: "calendar"    as const, tKey: "tab.planning" },
    {
      id: "rooster",
      label: "Rooster",
      icon: "calendar-clock" as const,
      href: `/${config.slug}/rooster`,
      tKey: "tab.schedule",
    },
    {
      id: "rapporten",
      label: "Uren",
      icon: "wallet" as const,
      href: `/${config.slug}/rapporten`,
      tKey: "tab.hours",
    },
    {
      id: "voorraad",
      label: "Voorraad",
      icon: "shopping-bag" as const,
      href: `/${config.slug}/voorraad`,
      tKey: "tab.inventory",
    },
    { id: "producten", label: "Producten",     icon: "shopping-bag" as const, tKey: "tab.products" },
    { id: "inzichten", label: "Inzichten",     icon: "lightbulb"   as const, tKey: "tab.insights" },
    {
      id: "admin",
      label: "Administratie",
      icon: "clipboard" as const,
      roles: ["owner"] as ("owner" | "manager")[],
      tKey: "tab.admin",
    },
    {
      id: "salaris",
      label: "Salaris",
      icon: "users" as const,
      roles: ["owner", "manager"] as ("owner" | "manager")[],
      tKey: "tab.salary",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Foutmeldingen */}
      {sumupFout && (
        <div className="card border-red-500/30 py-3">
          <p className="text-red-600 text-sm"><strong>SumUp:</strong> {sumupFout}</p>
        </div>
      )}
      {zettleFout && (
        <div className="card border-amber-300 py-3">
          <p className="text-amber-700 text-sm"><strong>Zettle:</strong> {zettleFout}</p>
        </div>
      )}

      {/* Tab-navigatie staat direct onder de LiveBalk; alle hero-widgets
          zitten binnen de Omzet-tab (de default tab) */}
      <DashboardNav tabs={TABS} hex={config.hex} bedrijf={config.slug}>
        {/* Tab 1 — Omzet (incl. hero-widgets die altijd direct zichtbaar zijn als default tab) */}
        <>
          {/* Manager-only: leaderboard + doel-tracker als hero */}
          <ManagerWidgets bedrijf={config.slug} hex={config.hex} />

          {/* Voorraad-alerts (zichtbaar voor iedereen, urgent als kritieke producten op zijn) */}
          <VoorraadAlerts bedrijf={config.slug} hex={config.hex} />

          {/* Live omzet + kerncijfers */}
          {heeftData && (
            <LiveRevenue
              bedrijf={config.slug}
              kleur={kleurNaam}
              hex={config.hex}
              verwachtVandaag={kerncijfers?.verwachtVandaag ?? 0}
              weekdagCurve={weekdagCurve}
            />
          )}

          <BezettingAdvies
            hex={config.hex}
            bedrijf={config.slug}
            dagOmzet={dagOmzet}
            prognose={prognose}
            geplandVandaag={bezVandaag}
          />

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
          {heeftData && (
            <RecenteTransacties bedrijf={config.slug} hex={config.hex} />
          )}
        </>

        {/* Tab 2 — Planning */}
        <>
          <RoosterVandaag diensten={diensten} hex={config.hex} />
          <RoosterWeek dagen={weekRooster} hex={config.hex} />
          <FeestdagenKalender events={verrijkteEvents} bedrijf={config.slug} />
          <CruiseAgenda dagen={cruiseDagen} />
          {prognose.length > 0 && kerncijfers && (
            <Forecast
              data={prognose}
              omzetVandaag={kerncijfers.vandaag.omzet}
              bedrijf={config.slug}
              cruises={cruiseHints}
              weer={weerHints}
            />
          )}
        </>

        {/* Tab 3 — Producten */}
        <>
          {topProducten.length > 0 && (
            <ProductsTable data={topProducten} hex={config.hex} />
          )}
          {productCombinaties.length > 0 && (
            <ProductCombinaties data={productCombinaties} hex={config.hex} />
          )}
          {productLevens.length > 0 && (
            <ProductenLevenslang
              data={productLevens}
              hex={config.hex}
              periodeLabel={config.paypalPeriode}
            />
          )}
        </>

        {/* Tab 4 — Inzichten */}
        <>
          <Schommelingen data={schommelingen} />
          {weerData.length > 0 && dagOmzet.length > 0 && (
            <WeerImpact dagOmzet={dagOmzet} weer={weerData} hex={config.hex} />
          )}
          {suggesties.length > 0 && (
            <OptimizatieSuggesties suggesties={suggesties} />
          )}
        </>

        {/* Tab 5 — Administratie (inline, owner-only) */}
        <AdminTab bedrijf={config.slug} hex={config.hex} />

        {/* Tab 6 — Salaris (inline, owner = detail, manager = aggregaat) */}
        <div className="space-y-5">
          <SalarisPanel bedrijf={config.slug} hex={config.hex} />
          <PersoneelPrestaties bedrijf={config.slug} hex={config.hex} />
          <BedrijfsInstellingen bedrijf={config.slug} hex={config.hex} />
          <InleenDoorberekening hex={config.hex} filterSlug={config.slug} />
          <VoorraadAfrekening hex={config.hex} filterSlug={config.slug} />
        </div>
      </DashboardNav>
    </div>
  );
}
