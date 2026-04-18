"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import SplitFlap from "@/components/SplitFlap";

interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
  gemBonVandaag: number;
  laatsteSale: { amount: number; timestamp: string } | null;
  error?: string;
}

const BEDRIJVEN = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕", kleur: "#FFC84A", bg: "#0d1117" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢", kleur: "#FFC84A", bg: "#0d1117" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟", kleur: "#FFC84A", bg: "#0d1117" },
];

function formatBord(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tijdGeleden(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}u`;
}

function BedrijfRij({ slug, naam, emoji }: { slug: string; naam: string; emoji: string }) {
  const [data, setData] = useState<LiveData | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/sumup/${slug}`, { cache: "no-store" });
      setData(await res.json());
    } catch {
      setData({ omzetVandaag: 0, aantalTransactiesVandaag: 0, gemBonVandaag: 0, laatsteSale: null, error: "–" });
    }
  }, [slug]);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 20_000);
    window.addEventListener("dashboard:refresh", fetch_);
    return () => { clearInterval(t); window.removeEventListener("dashboard:refresh", fetch_); };
  }, [fetch_]);

  const omzetStr = data ? formatBord(data.omzetVandaag) : "€–––,––";

  return (
    <Link href={`/${slug}`} className="block group">
      <div
        className="relative rounded-2xl overflow-hidden transition-transform duration-200 group-hover:scale-[1.01]"
        style={{ background: "#0d1117", border: "1px solid #1e2530" }}
      >
        {/* Bovenbalk met naam */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: "#0a0e14", borderBottom: "1px solid #1e2530" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{emoji}</span>
            <span
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: "#FFC84A", fontFamily: "monospace" }}
            >
              {naam}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping absolute" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          </div>
        </div>

        {/* Hoofd-bord */}
        <div className="px-4 py-4">
          <div className="mb-1">
            <span
              className="text-[10px] uppercase tracking-[0.25em] font-mono"
              style={{ color: "#4a5568" }}
            >
              Omzet vandaag
            </span>
          </div>
          <SplitFlap value={omzetStr} breedte={omzetStr.length} />
        </div>

        {/* Statistieken */}
        <div
          className="grid grid-cols-3 divide-x px-0"
          style={{ borderTop: "1px solid #1e2530", divideColor: "#1e2530" }}
        >
          {[
            { label: "Transacties", val: data ? String(data.aantalTransactiesVandaag) : "–" },
            { label: "Gem. bon",    val: data ? `€${data.gemBonVandaag.toFixed(2)}` : "–" },
            {
              label: "Laatste",
              val: data?.laatsteSale
                ? `€${data.laatsteSale.amount.toFixed(2)} · ${tijdGeleden(data.laatsteSale.timestamp)}`
                : "–",
            },
          ].map(({ label, val }) => (
            <div key={label} className="px-3 py-2 text-center" style={{ borderColor: "#1e2530" }}>
              <p className="text-[9px] uppercase tracking-widest font-mono mb-0.5" style={{ color: "#4a5568" }}>
                {label}
              </p>
              <p className="text-xs font-mono font-bold" style={{ color: "#9ca3af" }}>
                {val}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function OverzichtPage() {
  const [tijd, setTijd] = useState("");

  useEffect(() => {
    const tick = () =>
      setTijd(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#080b10" }}
    >
      {/* Header bord */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #1e2530" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-mono" style={{ color: "#4a5568" }}>
            Studio Goud
          </p>
          <p className="text-lg font-bold font-mono" style={{ color: "#FFC84A" }}>
            Omzetoverzicht
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "#4a5568" }}>
            Lokale tijd
          </p>
          <p className="text-lg font-mono tabular-nums" style={{ color: "#FFC84A" }}>
            {tijd}
          </p>
        </div>
      </div>

      {/* Drie bedrijven */}
      <div className="flex-1 p-4 sm:p-6 space-y-3 max-w-2xl mx-auto w-full">
        {BEDRIJVEN.map((b) => (
          <BedrijfRij key={b.slug} slug={b.slug} naam={b.naam} emoji={b.emoji} />
        ))}
      </div>

      <p className="text-center text-[10px] font-mono pb-4" style={{ color: "#2d3748" }}>
        Tik op een bedrijf voor het volledige dashboard · ververst elke 20s
      </p>
    </div>
  );
}
