"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import IngUpload from "@/components/administratie/IngUpload";
import FacturenPanel from "@/components/administratie/FacturenPanel";
import ContantInvoer from "@/components/administratie/ContantInvoer";
import MaandPnL from "@/components/administratie/MaandPnL";
import KwartaalRapport from "@/components/administratie/KwartaalRapport";

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
      <div className="flex items-center gap-3 mb-6">
        <a href={`/${bedrijf}`} className="text-slate-400 hover:text-slate-600 text-sm">
          ← Dashboard
        </a>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{config.naam}</h1>
          <p className="text-xs text-slate-400">Administratie & boekhouding {jaar}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Maandoverzicht met winst/verlies */}
        <MaandPnL bedrijf={bedrijf} hex={config.hex} key={`pnl-${refreshTrigger}`} />

        {/* ING bankafschrift upload */}
        <IngUpload bedrijf={bedrijf} hex={config.hex} onSuccess={refresh} />

        {/* Email facturen */}
        <FacturenPanel bedrijf={bedrijf} hex={config.hex} jaar={jaar} />

        {/* Contante transacties */}
        <ContantInvoer bedrijf={bedrijf} hex={config.hex} jaar={jaar} onWijziging={refresh} />

        {/* Kwartaalrapport download */}
        <KwartaalRapport bedrijf={bedrijf} hex={config.hex} />

        {/* Uitleg: benodigde env vars */}
        <div className="card border-blue-100 bg-blue-50/50">
          <h4 className="font-semibold text-blue-800 mb-2 text-sm">⚙️ Vercel configuratie vereist</h4>
          <p className="text-xs text-blue-700 mb-2">
            Stel de volgende environment variables in via <strong>Vercel → Settings → Environment Variables</strong>:
          </p>
          <div className="font-mono text-xs text-blue-900 space-y-1 bg-white rounded-lg p-3">
            <p><strong>ING koppeling (Tink):</strong></p>
            <p>TINK_CLIENT_ID = (van console.tink.com)</p>
            <p>TINK_CLIENT_SECRET = (van console.tink.com)</p>
            <p>NEXT_PUBLIC_BASE_URL = https://dashboardoverview.vercel.app</p>
            <p>CRON_SECRET = (zelf te kiezen wachtwoord)</p>
            <p className="mt-2"><strong>Email ({config.naam}):</strong></p>
            <p>EMAIL_USER_{bedrijf.toUpperCase()} = info@jullie-domein.nl</p>
            <p>EMAIL_PASS_{bedrijf.toUpperCase()} = email-wachtwoord</p>
            <p className="mt-2"><strong>Claude AI (factuur parser):</strong></p>
            <p>ANTHROPIC_API_KEY = sk-ant-... (staat er al in)</p>
          </div>
        </div>
      </div>
    </main>
  );
}
