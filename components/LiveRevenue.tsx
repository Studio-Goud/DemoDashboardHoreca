"use client";

import { useEffect, useState, useCallback } from "react";

interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
  laasteSale: {
    amount: number;
    timestamp: string;
    payment_type: string;
  } | null;
  timestamp: string;
}

interface Props {
  bedrijf: "bb" | "sl";
  kleur: string;
}

function tijdGeleden(isoString: string): string {
  const nu = new Date();
  const dan = new Date(isoString);
  const seconden = Math.floor((nu.getTime() - dan.getTime()) / 1000);
  if (seconden < 60) return `${seconden}s geleden`;
  const minuten = Math.floor(seconden / 60);
  if (minuten < 60) return `${minuten}m geleden`;
  const uren = Math.floor(minuten / 60);
  return `${uren}u geleden`;
}

export default function LiveRevenue({ bedrijf, kleur }: Props) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/sumup/${bedrijf}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setData((prev) => {
        if (prev && prev.omzetVandaag !== json.omzetVandaag) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1000);
        }
        return json;
      });
    } catch (e) {
      console.error("Live fetch mislukt:", e);
    } finally {
      setLoading(false);
    }
  }, [bedrijf]);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 30_000);
    const onRefresh = () => fetchLive();
    window.addEventListener("dashboard:refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("dashboard:refresh", onRefresh);
    };
  }, [fetchLive]);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/2 mb-2" />
        <div className="h-4 bg-white/5 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className={`card border-${kleur}/20 relative overflow-hidden`}>
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full bg-green-400 animate-ping absolute`} />
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs text-white/30 ml-3">live</span>
      </div>

      <p className="text-white/50 text-sm mb-1">Omzet vandaag</p>
      <div
        className={`stat-value text-${kleur} transition-all duration-300 ${
          pulse ? "scale-110" : "scale-100"
        }`}
      >
        €{data?.omzetVandaag?.toFixed(2) ?? "0.00"}
      </div>
      <p className="text-white/30 text-sm mt-1">
        {data?.aantalTransactiesVandaag ?? 0} transacties vandaag
      </p>

      {data?.laasteSale && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Laatste verkoop</p>
          <div className="flex items-center justify-between">
            <span className="font-semibold">€{data.laasteSale.amount.toFixed(2)}</span>
            <span className="text-white/40 text-sm">
              {tijdGeleden(data.laasteSale.timestamp)}
            </span>
          </div>
          <p className="text-white/30 text-xs mt-0.5 capitalize">
            {data.laasteSale.payment_type}
          </p>
        </div>
      )}

      <p className="text-white/20 text-xs mt-3">Ververst elke 30 seconden</p>
    </div>
  );
}
