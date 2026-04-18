"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { komendeEvents, type KomendEvent } from "@/lib/feestdagen";

const impactStyle: Record<KomendEvent["impact"], { bg: string; border: string; tekst: string; label: string }> = {
  hoog:    { bg: "bg-red-50",     border: "border-red-200",     tekst: "text-red-700",     label: "Hoge drukte" },
  middel:  { bg: "bg-amber-50",   border: "border-amber-200",   tekst: "text-amber-700",   label: "Middel" },
  laag:    { bg: "bg-emerald-50", border: "border-emerald-200", tekst: "text-emerald-700", label: "Laag" },
  dicht:   { bg: "bg-slate-100",  border: "border-slate-300",   tekst: "text-slate-600",   label: "Gesloten (NL)" },
};

export default function FeestdagenKalender() {
  const events = komendeEvents(90).slice(0, 10);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-slate-700">
          Feestdagen &amp; vakanties (komende 90 dagen)
        </h3>
        <span className="text-[11px] text-slate-400">
          NL · regio midden
        </span>
      </div>

      <div className="space-y-1.5">
        {events.map((e, i) => {
          const stijl = impactStyle[e.impact];
          return (
            <div
              key={i}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-2.5 rounded-lg border ${stijl.bg} ${stijl.border}`}
            >
              <div className="w-14 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  {format(e.datum, "MMM", { locale: nl })}
                </p>
                <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">
                  {format(e.datum, "dd")}
                </p>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${stijl.tekst}`}>
                  {e.naam}
                </p>
                <p className="text-[11px] text-slate-500">
                  {e.range
                    ? `${format(e.range.van, "dd-MM", { locale: nl })} t/m ${format(e.range.tot, "dd-MM-yyyy", { locale: nl })}`
                    : format(e.datum, "EEEE dd-MM-yyyy", { locale: nl })}
                  {" · "}
                  {e.dagenVanNu <= 0
                    ? "nu"
                    : e.dagenVanNu === 1
                    ? "morgen"
                    : `over ${e.dagenVanNu} dagen`}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold ${stijl.tekst}`}
                >
                  {stijl.label}
                </span>
                <p className="text-[10px] text-slate-400 capitalize">
                  {e.soort}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
