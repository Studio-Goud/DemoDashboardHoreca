"use client";

import { format, parseISO, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import type { Prognose } from "@/lib/analytics";

interface Props {
  data: Prognose[];
  omzetVandaag: number;
}

const drukKleur: Record<Prognose["druk"], string> = {
  laag: "bg-white/5 border-white/10 text-white/50",
  normaal: "bg-blue-500/10 border-blue-500/30 text-blue-200",
  druk: "bg-orange-500/10 border-orange-500/30 text-orange-200",
  "zeer druk": "bg-red-500/10 border-red-500/30 text-red-200",
};

const drukLabel: Record<Prognose["druk"], string> = {
  laag: "Rustig",
  normaal: "Normaal",
  druk: "Druk",
  "zeer druk": "Zeer druk",
};

export default function Forecast({ data, omzetVandaag }: Props) {
  if (data.length === 0) return null;

  const totaalVerwacht = data.reduce((s, p) => s + p.verwacht, 0);
  const druksteDag = data.reduce((a, b) => (a.verwacht > b.verwacht ? a : b));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white/80">14-daagse prognose</h3>
          <p className="text-[11px] text-white/30">
            Op basis van gem. laatste 8 weken per weekdag
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            Verwacht totaal
          </p>
          <p className="font-bold text-lg tabular-nums">
            €
            {totaalVerwacht.toLocaleString("nl-NL", {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {data.map((dag, i) => {
          const datum = parseISO(dag.datum);
          const vandaag = isToday(datum);
          const realisatie =
            vandaag && dag.verwacht > 0
              ? Math.round((omzetVandaag / dag.verwacht) * 100)
              : null;
          return (
            <div
              key={i}
              className={`rounded-xl p-3 text-center border ${drukKleur[dag.druk]} ${
                vandaag ? "ring-2 ring-white/40" : ""
              }`}
            >
              <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                {vandaag ? "Vandaag" : format(datum, "EEE", { locale: nl })}
              </p>
              <p className="text-[11px] opacity-60 mb-2">
                {format(datum, "d MMM", { locale: nl })}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                €{dag.verwacht.toFixed(0)}
              </p>
              <p className="text-[10px] opacity-60 mt-1">{drukLabel[dag.druk]}</p>

              {vandaag && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-[10px] text-white/60">
                    Nu: €{omzetVandaag.toFixed(0)}
                  </p>
                  {realisatie !== null && (
                    <p
                      className={`text-[10px] font-semibold ${
                        realisatie >= 100
                          ? "text-green-400"
                          : "text-orange-300"
                      }`}
                    >
                      {realisatie}%
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-white/40 mt-3">
        Drukste dag in prognose:{" "}
        <span className="text-white/70">{druksteDag.dagNaam}</span> · ~€
        {druksteDag.verwacht.toFixed(0)}
      </p>
    </div>
  );
}
