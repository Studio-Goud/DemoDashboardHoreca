"use client";

import { format, parseISO, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import type { Prognose } from "@/lib/analytics";

interface Props {
  data: Prognose[];
  omzetVandaag: number;
}

const drukKleur: Record<Prognose["druk"], string> = {
  laag: "bg-slate-50 border-slate-200 text-slate-500",
  normaal: "bg-blue-500/10 border-blue-500/30 text-blue-700",
  druk: "bg-orange-500/10 border-orange-500/30 text-orange-700",
  "zeer druk": "bg-red-500/10 border-red-500/30 text-red-700",
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
  const bruikbaarheid = data.filter((d) => d.verwacht > 0).length;

  // Onvoldoende historie om te voorspellen
  if (totaalVerwacht === 0 || bruikbaarheid < 3) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-1 text-slate-700">14-daagse prognose</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Nog onvoldoende historie in de laatste 8 weken om betrouwbaar te
          voorspellen. Prognose verschijnt zodra er ≥ 3 weken historie per
          weekdag beschikbaar is.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {data.slice(0, 7).map((dag, i) => (
            <div
              key={i}
              className="rounded-xl p-3 text-center border border-slate-100 bg-slate-50 text-slate-400"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide">
                {format(parseISO(dag.datum), "EEE", { locale: nl })}
              </p>
              <p className="text-[11px] opacity-60">
                {format(parseISO(dag.datum), "d MMM", { locale: nl })}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const druksteDag = data.reduce((a, b) => (a.verwacht > b.verwacht ? a : b));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">14-daagse prognose</h3>
          <p className="text-[11px] text-slate-400">
            Op basis van gem. laatste 8 weken per weekdag
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
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
                vandaag ? "ring-2 ring-slate-400" : ""
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
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-500">
                    Nu: €{omzetVandaag.toFixed(0)}
                  </p>
                  {realisatie !== null && (
                    <p
                      className={`text-[10px] font-semibold ${
                        realisatie >= 100
                          ? "text-emerald-600"
                          : "text-orange-600"
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

      <p className="text-[11px] text-slate-400 mt-3">
        Drukste dag in prognose:{" "}
        <span className="text-slate-600">{druksteDag.dagNaam}</span> · ~€
        {druksteDag.verwacht.toFixed(0)}
      </p>
    </div>
  );
}
