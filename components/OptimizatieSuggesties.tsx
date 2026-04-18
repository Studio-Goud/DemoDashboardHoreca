"use client";

import type { Suggestie } from "@/lib/analytics";

interface Props {
  suggesties: Suggestie[];
}

const toonConfig: Record<
  Suggestie["toon"],
  { bg: string; border: string; icon: string; tekst: string }
> = {
  positief: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: "↑",
    tekst: "text-emerald-700",
  },
  attentie: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "!",
    tekst: "text-amber-700",
  },
  waarschuwing: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "!",
    tekst: "text-red-700",
  },
  neutraal: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: "→",
    tekst: "text-slate-700",
  },
};

export default function OptimizatieSuggesties({ suggesties }: Props) {
  if (suggesties.length === 0) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 text-slate-700">
        Signalen &amp; suggesties · live
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {suggesties.map((s, i) => {
          const c = toonConfig[s.toon];
          return (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-xl border ${c.bg} ${c.border}`}
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${c.tekst} bg-white/70`}
              >
                {c.icon}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${c.tekst}`}>{s.titel}</p>
                <p className="text-[12px] text-slate-600 mt-0.5">
                  {s.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
