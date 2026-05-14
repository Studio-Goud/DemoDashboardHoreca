"use client";

import { notFound } from "next/navigation";
import SalarisPanel from "@/components/administratie/SalarisPanel";

type BedrijfSlug = "bb" | "sl" | "kl";

const BEDRIJVEN: Record<BedrijfSlug, { naam: string; emoji: string; hex: string }> = {
  bb: { naam: "Brunch & Brew",   emoji: "☕", hex: "#00B8FF" },
  sl: { naam: "Saté Lounge",     emoji: "🍢", hex: "#00D27A" },
  kl: { naam: "Het Kroket Loket", emoji: "🥟", hex: "#FF8A00" },
};

export default function SalarisPage({ params }: { params: { bedrijf: string } }) {
  const config = BEDRIJVEN[params.bedrijf as BedrijfSlug];
  if (!config) notFound();
  const bedrijf = params.bedrijf as BedrijfSlug;

  const jaar = new Date().getFullYear();

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/administratie/${bedrijf}`} className="text-slate-400 hover:text-slate-600 text-sm">
          ← Administratie
        </a>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{config.naam}</h1>
          <p className="text-xs text-slate-400">Salaris-administratie {jaar}</p>
        </div>
      </div>

      <SalarisPanel bedrijf={bedrijf} hex={config.hex} />
    </main>
  );
}
