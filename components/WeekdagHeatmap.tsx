"use client";

import { useState } from "react";
import type { WeekdagUur } from "@/lib/analytics";
import DetailSheet from "./sf/DetailSheet";

interface Props {
  data: WeekdagUur[];
  hex: string;
}

const DAG_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const DAG_NAMEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

export default function WeekdagHeatmap({ data, hex }: Props) {
  const [actief, setActief] = useState<{ weekdag: number; uur: number; cel: WeekdagUur | null; rijTotaal: number } | null>(null);
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
        <h3 className="font-semibold text-slate-700">Weekdag × uur heatmap</h3>
        <span className="text-[11px] text-slate-400">gem. € per uur</span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Kop met uurlabels */}
          <div className="flex text-[10px] text-slate-400 mb-1">
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
                <div className="w-8 text-[11px] text-slate-500 shrink-0">
                  {DAG_LABELS[wd]}
                </div>
                {uren.map((u) => {
                  const cel = matrix[wd]?.[u];
                  const gem = cel?.gemiddeld ?? 0;
                  const intensiteit = Math.min(gem / max, 1);
                  return (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setActief({ weekdag: wd, uur: u, cel: cel ?? null, rijTotaal })}
                      className="w-7 h-7 rounded-[4px] shrink-0 flex items-center justify-center mx-[1px] group relative transition-transform hover:scale-110 hover:z-10 cursor-pointer"
                      style={{
                        backgroundColor:
                          intensiteit > 0
                            ? `${hex}${Math.round(
                                0.15 + intensiteit * 0.7 * 255
                              )
                                .toString(16)
                                .padStart(2, "0")
                                .toUpperCase()}`
                            : "#F1F5F9",
                      }}
                      title={`${DAG_LABELS[wd]} ${String(u).padStart(
                        2,
                        "0"
                      )}:00 — gem. €${gem.toFixed(2)} (${cel?.aantalDagen ?? 0}x gemeten) · klik voor detail`}
                    >
                      {intensiteit > 0.6 && (
                        <span className="text-[9px] font-semibold text-slate-800 tabular-nums">
                          {Math.round(gem)}
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="w-14 pl-2 text-[10px] text-slate-400 tabular-nums shrink-0">
                  €{Math.round(rijTotaal)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400">
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
        <span className="ml-auto">tik op een cel voor detail</span>
      </div>

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief ? `${DAG_NAMEN[actief.weekdag]} · ${String(actief.uur).padStart(2, "0")}:00–${String(actief.uur + 1).padStart(2, "0")}:00` : ""}
        subtitel="Historisch gemiddelde per weekdag-uur"
        hex={hex}
      >
        {actief && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
              <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                Gemiddelde omzet dit uur
              </p>
              <p
                className="font-display text-[36px] font-semibold tabular-nums leading-none"
                style={{ color: hex, letterSpacing: "-0.018em" }}
              >
                €{(actief.cel?.gemiddeld ?? 0).toFixed(2)}
              </p>
              <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                Gemeten over {actief.cel?.aantalDagen ?? 0} {DAG_NAMEN[actief.weekdag]}{(actief.cel?.aantalDagen ?? 0) === 1 ? "" : "en"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                  Totaal dit uur
                </p>
                <p className="font-display text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  €{(actief.cel?.totaal ?? 0).toFixed(0)}
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                  alle metingen samen
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                  Dagtotaal
                </p>
                <p className="font-display text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  €{Math.round(actief.rijTotaal)}
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                  gem. hele {DAG_NAMEN[actief.weekdag]}
                </p>
              </div>
            </div>

            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Gebruik dit om te plannen: drukke uren = meer personeel, rustige uren = misschien
              promotie of administratie. Hoe meer metingen, hoe betrouwbaarder het gemiddelde.
            </p>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
