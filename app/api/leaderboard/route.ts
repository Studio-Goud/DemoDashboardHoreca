import { NextResponse } from "next/server";
import { dashboardAggregaten } from "@/lib/dashboard-cache";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const BEDRIJVEN_ECHT: { slug: Bedrijf; naam: string; hex: string }[] = [
  { slug: "bb", naam: "Brunch & Brew",    hex: "#0A84FF" },
  { slug: "sl", naam: "Saté Lounge",      hex: "#30B26F" },
  { slug: "kl", naam: "Het Kroket Loket", hex: "#E07A1F" },
];

const BEDRIJVEN_DEMO: { slug: Bedrijf; naam: string; hex: string }[] = [
  { slug: "bb", naam: "Grand Café De Zon",  hex: "#0A84FF" },
  { slug: "sl", naam: "Brasserie Noord",    hex: "#30B26F" },
  { slug: "kl", naam: "Bar & Kitchen West", hex: "#E07A1F" },
];

const BEDRIJVEN = DEMO_MODE ? BEDRIJVEN_DEMO : BEDRIJVEN_ECHT;

interface BedrijfRij {
  slug: Bedrijf;
  naam: string;
  hex: string;
  dezeWeek:   { omzet: number; txs: number };
  vorigeWeek: { omzet: number; txs: number };
  vandaag:    { omzet: number; txs: number; verwacht: number };
  groei: { tovVorigeWeek: number };
  fout?: string;
}

export async function GET() {
  const resultaten = await Promise.all(
    BEDRIJVEN.map(async (b): Promise<BedrijfRij> => {
      try {
        const agg = await dashboardAggregaten(b.slug);
        const k = agg.kerncijfers;
        if (!k) {
          return {
            ...b,
            dezeWeek:   { omzet: 0, txs: 0 },
            vorigeWeek: { omzet: 0, txs: 0 },
            vandaag:    { omzet: 0, txs: 0, verwacht: 0 },
            groei: { tovVorigeWeek: 0 },
            fout: "geen kerncijfers",
          };
        }
        return {
          ...b,
          dezeWeek:   { omzet: k.dezeWeek.omzet,   txs: k.dezeWeek.txs },
          vorigeWeek: { omzet: k.vorigeWeek.omzet, txs: k.vorigeWeek.txs },
          vandaag:    { omzet: k.vandaag.omzet,   txs: k.vandaag.txs, verwacht: k.verwachtVandaag ?? 0 },
          groei: { tovVorigeWeek: k.groei?.tovVorigeWeek ?? 0 },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "onbekend";
        return {
          ...b,
          dezeWeek:   { omzet: 0, txs: 0 },
          vorigeWeek: { omzet: 0, txs: 0 },
          vandaag:    { omzet: 0, txs: 0, verwacht: 0 },
          groei: { tovVorigeWeek: 0 },
          fout: msg,
        };
      }
    }),
  );

  return NextResponse.json({
    bedrijven: resultaten,
    gegenereerd: new Date().toISOString(),
  });
}
