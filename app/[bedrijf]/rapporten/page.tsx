import { notFound } from "next/navigation";
import UrenRapport from "@/components/UrenRapport";
import BedrijfTabBar from "@/components/BedrijfTabBar";
import TabHero from "@/components/TabHero";

export const dynamic = "force-dynamic";

const BEDRIJVEN: Record<string, { naam: string; hex: string }> = {
  bb: { naam: "Brunch & Brew",    hex: "#0A84FF" },
  sl: { naam: "Saté Lounge",      hex: "#30B26F" },
  kl: { naam: "Het Kroket Loket", hex: "#E07A1F" },
};

function huidigeMaand(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  params: { bedrijf: string };
  searchParams: { maand?: string };
}

export default function RapportenPage({ params, searchParams }: Props) {
  const config = BEDRIJVEN[params.bedrijf];
  if (!config) notFound();

  const maand = searchParams.maand && /^\d{4}-\d{2}$/.test(searchParams.maand)
    ? searchParams.maand
    : huidigeMaand();

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <BedrijfTabBar bedrijf={params.bedrijf as "bb" | "sl" | "kl"} actiefId="rapporten" />
      <TabHero titel="Uren" icon="wallet" accent="#FFD60A" />
      <div>
        <UrenRapport bedrijf={params.bedrijf} naam={config.naam} hex={config.hex} maand={maand} />
      </div>
    </main>
  );
}
