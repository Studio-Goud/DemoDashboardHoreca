"use client";

import { useEffect, useState } from "react";

interface Props {
  hex: string;
}

function Block({ h, className = "" }: { h: number; className?: string }) {
  return (
    <div
      className={`bg-slate-100 rounded-lg animate-pulse ${className}`}
      style={{ height: h }}
    />
  );
}

export default function DashboardSkeleton({ hex }: Props) {
  const [seconden, setSeconden] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSeconden((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fase =
    seconden < 3
      ? "SumUp API wordt benaderd…"
      : seconden < 10
      ? "Transacties ophalen (SumUp + Zettle pagineren)…"
      : seconden < 25
      ? "Historie verwerken (kan bij volledige Zettle-historie even duren)…"
      : "Duurt langer dan gewoonlijk — wacht even of ververs de pagina.";

  return (
    <div className="space-y-6">
      {/* Live block */}
      <div className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <div
            className="w-24 h-3 rounded animate-pulse"
            style={{ backgroundColor: `${hex}40` }}
          />
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: hex }}
            />
            <span className="text-xs tabular-nums" style={{ color: hex }}>
              {seconden}s
            </span>
          </div>
        </div>
        <div
          className="w-48 h-10 rounded animate-pulse"
          style={{ backgroundColor: `${hex}55` }}
        />
        <Block h={16} className="w-40" />
        <Block h={8} className="w-full" />
        <p className="text-[11px] text-slate-500">{fase}</p>
      </div>

      {/* Kerncijfers */}
      <div className="card">
        <Block h={18} className="w-32 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Block h={10} className="w-20" />
              <Block h={24} className="w-28" />
              <Block h={10} className="w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <Block h={18} className="w-40 mb-3" />
        <Block h={260} className="w-full" />
      </div>

      {/* Vergelijken */}
      <div className="card">
        <Block h={18} className="w-28 mb-3" />
        <Block h={180} className="w-full" />
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm text-slate-500 tabular-nums">
          Data wordt opgehaald — {seconden}s bezig
        </p>
        <p className="text-[11px] text-slate-400">
          Typisch 5–15s. Bij volledige Zettle-historie (jaren aan transacties)
          kan dit 20–40s duren.
        </p>
      </div>
    </div>
  );
}
