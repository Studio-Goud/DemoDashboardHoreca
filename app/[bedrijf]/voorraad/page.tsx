import { notFound } from "next/navigation";
import type { Bedrijf } from "@/lib/sumup";
import { listProducten } from "@/lib/voorraad";
import VoorraadBeheer from "@/components/VoorraadBeheer";
import BedrijfTabBar from "@/components/BedrijfTabBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BEDRIJVEN: Record<string, { naam: string; hex: string; slug: Bedrijf }> = {
  bb: { naam: "Brunch & Brew",    hex: "#0A84FF", slug: "bb" },
  sl: { naam: "Saté Lounge",      hex: "#30B26F", slug: "sl" },
  kl: { naam: "Het Kroket Loket", hex: "#E07A1F", slug: "kl" },
};

interface Props { params: { bedrijf: string } }

export default async function VoorraadPage({ params }: Props) {
  const config = BEDRIJVEN[params.bedrijf];
  if (!config) notFound();

  const producten = await listProducten(config.slug).catch(() => []);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <BedrijfTabBar bedrijf={config.slug} actiefId="voorraad" />
      <div className="mt-4">
      <VoorraadBeheer
        bedrijf={config.slug}
        naam={config.naam}
        hex={config.hex}
        initieleProducten={producten}
      />
      </div>
    </main>
  );
}
