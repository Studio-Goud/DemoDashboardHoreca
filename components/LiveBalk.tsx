"use client";

import { useEffect, useState, useCallback } from "react";

const BEDRIJVEN = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕", kleur: "#00B8FF" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢", kleur: "#00D27A" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟", kleur: "#FF8A00" },
];

interface LiveData {
  omzetVandaag: number;
  gemBonVandaag: number;
  aantalTransactiesVandaag: number;
  laatsteSale: { amount: number; timestamp: string } | null;
}

function tijdGeleden(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}u`;
}

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BedrijfKolom({
  slug, naam, emoji, kleur,
}: {
  slug: string; naam: string; emoji: string; kleur: string;
}) {
  const [data, setData] = useState<LiveData | null>(null);

  const laadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sumup/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      // stil falen — balk blijft zichtbaar met streepjes
    }
  }, [slug]);

  useEffect(() => {
    laadData();
    const t = setInterval(laadData, 20_000);
    window.addEventListener("dashboard:refresh", laadData);
    return () => {
      clearInterval(t);
      window.removeEventListener("dashboard:refresh", laadData);
    };
  }, [laadData]);

  const omzet   = data ? fmt(data.omzetVandaag)  : "€–";
  const gemBon  = data ? fmt(data.gemBonVandaag)  : "–";
  const laatste = data?.laatsteSale
    ? `${fmt(data.laatsteSale.amount)} · ${tijdGeleden(data.laatsteSale.timestamp)}`
    : "–";

  return (
    <div
      className="flex-1 px-3 sm:px-4 py-2 border-r last:border-r-0"
      style={{ borderColor: "#1e2530" }}
    >
      {/* Bedrijfsnaam */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm leading-none">{emoji}</span>
        <span
          className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] font-mono truncate"
          style={{ color: kleur }}
        >
          {naam}
        </span>
      </div>

      {/* Omzet vandaag */}
      <p
        className="text-sm sm:text-base font-bold font-mono tabular-nums leading-tight"
        style={{ color: "#e2e8f0" }}
      >
        {omzet}
      </p>

      {/* Gem. bon + laatste bon */}
      <div className="flex flex-col sm:flex-row sm:gap-3 mt-0.5">
        <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#64748b" }}>
          gem.&nbsp;{gemBon}
        </span>
        <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#64748b" }}>
          {laatste}
        </span>
      </div>
    </div>
  );
}

export default function LiveBalk() {
  return (
    <div
      className="flex w-full sticky top-0 z-50"
      style={{ background: "#0a0e14", borderBottom: "1px solid #1e2530" }}
    >
      {BEDRIJVEN.map((b) => (
        <BedrijfKolom key={b.slug} {...b} />
      ))}
    </div>
  );
}
