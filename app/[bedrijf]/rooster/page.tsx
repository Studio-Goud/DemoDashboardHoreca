import { notFound } from "next/navigation";
import type { Bedrijf } from "@/lib/sumup";
import {
  fetchDienstenInRange,
  medewerkersPerBedrijf,
  shiftTemplatesPerBedrijf,
  fetchBeschikbaarheid,
} from "@/lib/rooster";
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

export default async function RoosterEditorPage({ params, searchParams }: Props) {
  const config = BEDRIJVEN[params.bedrijf];
  if (!config) notFound();

  // Bepaal de week (maandag t/m zondag)
  const startDatum = searchParams.week
    ? maandagVanWeek(new Date(searchParams.week))
    : maandagVanWeek(new Date());
  const eindDatum = plusDagen(startDatum, 6);

  const [alleDiensten, medewerkers, templates, beschikbaarheid] = await Promise.all([
    fetchDienstenInRange(startDatum, eindDatum).catch(() => []),
    medewerkersPerBedrijf(config.slug).catch(() => []),
    shiftTemplatesPerBedrijf(config.slug).catch(() => []),
    fetchBeschikbaarheid(startDatum, eindDatum).catch((e) => {
      console.error("Shiftbase availability fout:", e);
      return [] as Awaited<ReturnType<typeof fetchBeschikbaarheid>>;
    }),
  ]);

  // Filter diensten op bedrijf én op publish+concept (we tonen beide voor editor)
  // Maar fetchDienstenInRange filtert al op gepubliceerd=true; voor editor willen
  // we ook concepten zien.
  const diensten = alleDiensten.filter((d) => d.bedrijf === config.slug);

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
      />
      </div>
    </main>
  );
}
