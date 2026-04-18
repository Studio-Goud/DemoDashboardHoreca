import Link from "next/link";
import PullToRefresh from "@/components/PullToRefresh";
import LiveRevenue from "@/components/LiveRevenue";
import RevenueChart from "@/components/RevenueChart";
import PeakHoursHeatmap from "@/components/PeakHoursHeatmap";
import ProductsTable from "@/components/ProductsTable";
import Forecast from "@/components/Forecast";
import Schommelingen from "@/components/Schommelingen";
import OptimizatieSuggesties from "@/components/OptimizatieSuggesties";
import { notFound } from "next/navigation";

const BEDRIJVEN = {
  bb: {
    naam: "Brunch & Brew",
    emoji: "☕",
    kleur: "bb-primary",
    hex: "#C8963E",
    slug: "bb",
  },
  sl: {
    naam: "Saté Lounge",
    emoji: "🍢",
    kleur: "sl-primary",
    hex: "#E63946",
    slug: "sl",
  },
};

type Params = { bedrijf: string };

async function getDashboardData(bedrijf: string) {
  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/sumup/${bedrijf}?type=dashboard`, {
    next: { revalidate: 300 }, // Elke 5 minuten herladen
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function DashboardPage({ params }: { params: Params }) {
  const config = BEDRIJVEN[params.bedrijf as keyof typeof BEDRIJVEN];
  if (!config) notFound();

  const data = await getDashboardData(params.bedrijf);

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
        {data && (
          <p className="text-white/30 text-sm">
            {data.totaalTransacties.toLocaleString("nl-NL")} transacties in totaal
          </p>
        )}
      </div>

      {!data ? (
        <div className="card text-center py-12">
          <p className="text-white/50 mb-2">Kon geen data ophalen van SumUp.</p>
          <p className="text-white/30 text-sm">Controleer of de API key correct is ingesteld.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Live omzet bovenaan — prominent */}
          <LiveRevenue bedrijf={config.slug as "bb" | "sl"} kleur={config.kleur} />

          {/* Omzetgrafiek */}
          {data.dagOmzet?.length > 0 && (
            <RevenueChart
              data={data.dagOmzet}
              kleur={config.kleur}
              hex={config.hex}
            />
          )}

          {/* Piekuren + Schommelingen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.piekuren?.length > 0 && (
              <PeakHoursHeatmap data={data.piekuren} hex={config.hex} />
            )}
            {data.schommelingen && (
              <Schommelingen data={data.schommelingen} />
            )}
          </div>

          {/* Producten */}
          {data.topProducten?.length > 0 && (
            <ProductsTable data={data.topProducten} hex={config.hex} />
          )}

          {/* Prognose */}
          {data.prognose?.length > 0 && <Forecast data={data.prognose} />}

          {/* Suggesties */}
          {data.suggesties?.length > 0 && (
            <OptimizatieSuggesties suggesties={data.suggesties} />
          )}

          {/* Footer info */}
          <div className="text-center text-white/20 text-xs pb-6">
            Gebaseerd op volledige SumUp-geschiedenis ·{" "}
            {data.periodeVan && (
              <>
                Vanaf{" "}
                {new Date(data.periodeVan).toLocaleDateString("nl-NL")}
              </>
            )}
          </div>
        </div>
      )}
    </main>
    </PullToRefresh>
  );
}
