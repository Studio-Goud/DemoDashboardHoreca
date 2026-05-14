"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import IngUpload from "@/components/administratie/IngUpload";
import FacturenPanel from "@/components/administratie/FacturenPanel";
import ContantInvoer from "@/components/administratie/ContantInvoer";
import MaandPnL from "@/components/administratie/MaandPnL";
import KwartaalRapport from "@/components/administratie/KwartaalRapport";
import ReviewPanel from "@/components/administratie/ReviewPanel";
import SetupPanel from "@/components/administratie/SetupPanel";

type BedrijfSlug = "bb" | "sl" | "kl";

const BEDRIJVEN: Record<BedrijfSlug, { naam: string; emoji: string; hex: string }> = {
  bb: { naam: "Brunch & Brew",   emoji: "☕", hex: "#00B8FF" },
  sl: { naam: "Saté Lounge",     emoji: "🍢", hex: "#00D27A" },
  kl: { naam: "Het Kroket Loket", emoji: "🥟", hex: "#FF8A00" },
};

export default function AdministratiePage({ params }: { params: { bedrijf: string } }) {
  const config = BEDRIJVEN[params.bedrijf as BedrijfSlug];
  if (!config) notFound();
  const bedrijf = params.bedrijf as BedrijfSlug;

  const nu = new Date();
  const jaar = nu.getFullYear();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refresh = () => setRefreshTrigger((n) => n + 1);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <a href={`/${bedrijf}`} className="text-slate-400 hover:text-slate-600 text-sm">
          ← Dashboard
        </a>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-2xl">{config.emoji}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800">{config.naam}</h1>
          <p className="text-xs text-slate-400">Administratie & boekhouding {jaar}</p>
        </div>
        <a
          href={`/administratie/${bedrijf}/salaris`}
          className="text-xs font-medium px-3 py-1.5 rounded text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: config.hex }}
        >
          🧑‍💼 Salaris →
        </a>
      </div>

      <div className="space-y-5">
        {/* Maandoverzicht met winst/verlies */}
        <MaandPnL bedrijf={bedrijf} hex={config.hex} key={`pnl-${refreshTrigger}`} />

        {/* ING bankafschrift upload */}
        <IngUpload bedrijf={bedrijf} hex={config.hex} onSuccess={refresh} />

        {/* Review: ongecategoriseerde transacties */}
        <ReviewPanel bedrijf={bedrijf} hex={config.hex} jaar={jaar} key={`review-${refreshTrigger}`} />

        {/* Email facturen */}
        <FacturenPanel bedrijf={bedrijf} hex={config.hex} jaar={jaar} />

        {/* Contante transacties */}
        <ContantInvoer bedrijf={bedrijf} hex={config.hex} jaar={jaar} onWijziging={refresh} />

        {/* Kwartaalrapport download */}
        <KwartaalRapport bedrijf={bedrijf} hex={config.hex} />

        {/* Setup — DB-init + Shiftbase-migratie (owner-only) */}
        <SetupPanel hex={config.hex} />

      </div>
    </main>
  );
}
