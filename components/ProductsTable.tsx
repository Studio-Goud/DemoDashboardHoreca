"use client";

import type { ProductData } from "@/lib/analytics";

interface Props {
  data: ProductData[];
  hex: string;
}

export default function ProductsTable({ data, hex }: Props) {
  const top = data.slice(0, 8);
  const bottom = data.slice(-5).reverse();
  const max = top[0]?.omzet ?? 1;

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-white/80">Hardlopers & Doodlopers</h3>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-green-400 uppercase tracking-wide mb-3">🔥 Top 8</p>
          <div className="space-y-2">
            {top.map((p, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-white/80 truncate max-w-[120px]">{p.naam}</span>
                  <span className="text-white/50 text-xs">€{p.omzet.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(p.omzet / max) * 100}%`,
                      backgroundColor: hex,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-red-400 uppercase tracking-wide mb-3">🧊 Doodlopers</p>
          <div className="space-y-2">
            {bottom.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/50 truncate max-w-[120px]">{p.naam}</span>
                <span className="text-white/30 text-xs">€{p.omzet.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
