import { notFound } from "next/navigation";
import type { Bedrijf } from "@/lib/sumup";
import {
  fetchDienstenInRange,
  medewerkersPerBedrijf,
  shiftTemplatesPerBedrijf,
  fetchBeschikbaarheid,
} from "@/lib/rooster";
import { dashboardAggregaten } from "@/lib/dashboard-cache";
import { getWeer, weerInfo } from "@/lib/weer";
import { cruisesOpDatum } from "@/lib/cruises";
import { feestdagOpDatum, vakantieOpDatum } from "@/lib/feestdagen";
import RoosterEditor from "@/components/RoosterEditor";
import BedrijfTabBar from "@/components/BedrijfTabBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BEDRIJVEN: Record<string, { naam: string; hex: string; slug: Bedrijf }> = {
  bb: { naam: "Brunch & Brew",    hex: "#0A84FF", slug: "bb" },
  sl: { naam: "Saté Lounge",      hex: "#30B26F", slug: "sl" },
  kl: { naam: "Het Kroket Loket", hex: "#E07A1F", slug: "kl" },
};

// Maandag van de week waarin gegevenDate valt (ISO weekstart)
function maandagVanWeek(d: Date): string {
  const day = d.getDay(); // 0=zo .. 6=za
  const verschil = day === 0 ? -6 : 1 - day;
  const ma = new Date(d);
  ma.setDate(d.getDate() + verschil);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(ma);
}

function plusDagen(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(dt);
}

interface Props {
  params: { bedrijf: string };
  searchParams: { week?: string };
}

export interface DagContext {
  datum: string;            // YYYY-MM-DD
  weekdag: number;          // 0=zo .. 6=za
  weer: {
    tempMax: number;
    tempMin: number;
    neerslag: number;
    emoji: string;
    categorie: string;
  } | null;
  prognose: {
    verwacht: number;       // EUR
    druk: "laag" | "normaal" | "druk" | "zeer druk" | "gesloten";
  } | null;
  cruises: Array<{
    schip: string;
    passagiers: number;
    aankomst: string | null;
    vertrek: string | null;
  }>;
  totaalPassagiers: number;
  feestdag: string | null;
  vakantie: string | null;
}

export default async function RoosterEditorPage({ params, searchParams }: Props) {
  const config = BEDRIJVEN[params.bedrijf];
  if (!config) notFound();

  // Bepaal de week (maandag t/m zondag)
  const startDatum = searchParams.week
    ? maandagVanWeek(new Date(searchParams.week))
    : maandagVanWeek(new Date());
  const eindDatum = plusDagen(startDatum, 6);

  const [alleDiensten, medewerkers, templates, beschikbaarheid, agg, weerData] = await Promise.all([
    fetchDienstenInRange(startDatum, eindDatum).catch(() => []),
    medewerkersPerBedrijf(config.slug).catch(() => []),
    shiftTemplatesPerBedrijf(config.slug).catch(() => []),
    fetchBeschikbaarheid(startDatum, eindDatum).catch((e) => {
      console.error("Shiftbase availability fout:", e);
      return [] as Awaited<ReturnType<typeof fetchBeschikbaarheid>>;
    }),
    dashboardAggregaten(config.slug).catch((e) => {
      console.error("Dashboard agg fout:", e);
      return null;
    }),
    getWeer().catch(() => []),
  ]);

  const diensten = alleDiensten.filter((d) => d.bedrijf === config.slug);

  // Bouw lookups: prognose per datum, weer per datum
  const prognoseMap = new Map<string, NonNullable<DagContext["prognose"]>>();
  if (agg) {
    for (const p of agg.prognose) {
      prognoseMap.set(p.datum, { verwacht: p.verwacht, druk: p.druk });
    }
  }
  const weerMap = new Map<string, NonNullable<DagContext["weer"]>>();
  for (const w of weerData) {
    const info = weerInfo(w.weerCode);
    weerMap.set(w.datum, {
      tempMax: w.tempMax,
      tempMin: w.tempMin,
      neerslag: w.neerslag,
      emoji: info.emoji,
      categorie: info.categorie,
    });
  }

  // Bouw context per dag voor week
  const dagContexten: DagContext[] = [];
  for (let i = 0; i < 7; i++) {
    const datum = plusDagen(startDatum, i);
    const [y, m, d] = datum.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const weekdag = dt.getUTCDay();

    const cruiseCalls = cruisesOpDatum(datum);
    const cruises = cruiseCalls.map((c) => ({
      schip: c.ship,
      passagiers: c.passagiers,
      aankomst: c.arrival ?? null,
      vertrek: c.departure ?? null,
    }));
    const totaalPassagiers = cruises.reduce((s, c) => s + c.passagiers, 0);

    const feest = feestdagOpDatum(dt);
    const vak = vakantieOpDatum(dt);

    dagContexten.push({
      datum,
      weekdag,
      weer: weerMap.get(datum) ?? null,
      prognose: prognoseMap.get(datum) ?? null,
      cruises,
      totaalPassagiers,
      feestdag: feest?.naam ?? null,
      vakantie: vak?.naam ?? null,
    });
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
      <BedrijfTabBar bedrijf={config.slug} actiefId="rooster" />
      <div className="mt-4">
      <RoosterEditor
        bedrijf={config.slug}
        naam={config.naam}
        hex={config.hex}
        weekStart={startDatum}
        weekEind={eindDatum}
        initieleDiensten={diensten}
        medewerkers={medewerkers}
        templates={templates}
        beschikbaarheid={beschikbaarheid}
        dagContexten={dagContexten}
      />
      </div>
    </main>
  );
}
