"use client";

import type { WeekdagUur } from "@/lib/analytics";

interface Props {
  data: WeekdagUur[];
  hex: string;
}

const DAG_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

export default function WeekdagHeatmap({ data, hex }: Props) {
  const max = Math.max(...data.map((d) => d.gemiddeld), 1);

  // Beperk tot uren met enige activiteit om het compacter te houden
  const uren = Array.from({ length: 24 }, (_, i) => i).filter((u) =>
    data.some((d) => d.uur === u && d.gemiddeld > 0.5)
  );

  const matrix: Record<number, Record<number, WeekdagUur>> = {};
  for (const cel of data) {
    if (!matrix[cel.weekdag]) matrix[cel.weekdag] = {};
    matrix[cel.weekdag][cel.uur] = cel;
  }

  // Sorteer dagen zodat week begint op maandag (visueel logischer)
  const dagenVolgorde = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-white/80">Weekdag × uur heatmap</h3>
        <span className="text-[11px] text-white/30">gem. € per uur</span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Kop met uurlabels */}
          <div className="flex text-[10px] text-white/30 mb-1">
            <div className="w-8 shrink-0" />
            {uren.map((u) => (
              <div
                key={u}
                className="w-7 text-center tabular-nums shrink-0"
              >
                {String(u).padStart(2, "0")}
              </div>
            ))}
          </div>

          {dagenVolgorde.map((wd) => {
            const rijTotaal = uren.reduce(
              (s, u) => s + (matrix[wd]?.[u]?.gemiddeld ?? 0),
              0
            );
            return (
              <div key={wd} className="flex items-center mb-1">
                <div className="w-8 text-[11px] text-white/50 shrink-0">
                  {DAG_LABELS[wd]}
                </div>
                {uren.map((u) => {
                  const cel = matrix[wd]?.[u];
                  const gem = cel?.gemiddeld ?? 0;
                  const intensiteit = Math.min(gem / max, 1);
                  return (
                    <div
                      key={u}
                      className="w-7 h-7 rounded-[4px] shrink-0 flex items-center justify-center mx-[1px] group relative"
                      style={{
                        backgroundColor:
                          intensiteit > 0
                            ? `${hex}${Math.round(
                                0.15 + intensiteit * 0.7 * 255
                              )
                                .toString(16)
                                .padStart(2, "0")
                                .toUpperCase()}`
                            : "rgba(255,255,255,0.03)",
                      }}
                      title={`${DAG_LABELS[wd]} ${String(u).padStart(
                        2,
                        "0"
                      )}:00 — gem. €${gem.toFixed(2)} (${cel?.aantalDagen ?? 0}x gemeten)`}
                    >
                      {intensiteit > 0.6 && (
                        <span className="text-[9px] font-semibold text-white/90 tabular-nums">
                          {Math.round(gem)}
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="w-14 pl-2 text-[10px] text-white/40 tabular-nums shrink-0">
                  €{Math.round(rijTotaal)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] text-white/40">
        <span>minder</span>
        <div className="flex gap-[2px]">
          {[0.1, 0.25, 0.45, 0.65, 0.85].map((i) => (
            <div
              key={i}
              className="w-4 h-3 rounded-sm"
              style={{
                backgroundColor: `${hex}${Math.round(i * 255)
                  .toString(16)
                  .padStart(2, "0")
                  .toUpperCase()}`,
              }}
            />
          ))}
        </div>
        <span>meer</span>
      </div>
    </div>
  );
}
