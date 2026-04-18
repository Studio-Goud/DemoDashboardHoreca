"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import type { CruiseDag, CruiseImpact } from "@/lib/cruises";
import { impactLabel } from "@/lib/cruises";

interface Props {
  dagen: CruiseDag[];
}

const impactStijl: Record<CruiseImpact, { bg: string; border: string; tekst: string; dot: string }> = {
  hoog:     { bg: "bg-red-50",     border: "border-red-200",     tekst: "text-red-700",     dot: "bg-red-500" },
  middel:   { bg: "bg-orange-50",  border: "border-orange-200",  tekst: "text-orange-700",  dot: "bg-orange-500" },
  laag:     { bg: "bg-sky-50",     border: "border-sky-200",     tekst: "text-sky-700",     dot: "bg-sky-500" },
  minimaal: { bg: "bg-slate-50",   border: "border-slate-200",   tekst: "text-slate-500",   dot: "bg-slate-400" },
};

function fmtPax(n: number): string {
  return n.toLocaleString("nl-NL");
}

export default function CruiseAgenda({ dagen }: Props) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-slate-700">
          Cruises in Rotterdam (komende 14 dagen)
        </h3>
        <span className="text-[11px] text-slate-400">
          Bron: Cruise Port Rotterdam
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Grotere cruises brengen toeristen richting Markthal. Hoog impact vanaf
        3.000 passagiers, middel vanaf 1.500. Check bezetting bij overlap met
        drukke weekdagen.
      </p>

      {dagen.length === 0 ? (
        <p className="text-slate-400 text-sm">
          Geen cruises aangekondigd in de komende 14 dagen.
        </p>
      ) : (
        <div className="space-y-1.5">
          {dagen.map((dag) => {
            const stijl = impactStijl[dag.piekImpact];
            return (
              <div
                key={dag.datum}
                className={`rounded-lg border ${stijl.bg} ${stijl.border} p-2.5`}
              >
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div className="w-14 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {format(parseISO(dag.datum), "EEE", { locale: nl })}
                    </p>
                    <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">
                      {format(parseISO(dag.datum), "dd", { locale: nl })}
                    </p>
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      {format(parseISO(dag.datum), "MM", { locale: nl })}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${stijl.tekst}`}>
                      {dag.cruises.length}× cruise ·{" "}
                      <span className="tabular-nums">{fmtPax(dag.totaalPassagiers)} passagiers</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {dag.dagenVanNu <= 0
                        ? "vandaag"
                        : dag.dagenVanNu === 1
                        ? "morgen"
                        : `over ${dag.dagenVanNu} dagen`}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${stijl.dot}`}
                      />
                      <span
                        className={`text-[10px] uppercase tracking-wide font-semibold ${stijl.tekst}`}
                      >
                        {impactLabel(dag.piekImpact)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  {dag.cruises.map((c, i) => (
                    <div
                      key={`${c.ship}-${i}`}
                      className="grid grid-cols-[1fr_auto] gap-3 text-[12px]"
                    >
                      <div className="min-w-0">
                        <span className="text-slate-800 font-medium truncate">
                          {c.ship}
                        </span>
                        <span className="text-slate-400 ml-1">
                          · {c.cruiseLine}
                        </span>
                        {c.notities && (
                          <span className="ml-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded">
                            {c.notities}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-slate-500 tabular-nums whitespace-nowrap">
                        {c.arrival ?? "—"}
                        {c.departure ? ` → ${c.departure}` : ""}
                        <span className="ml-2 text-slate-700 font-medium">
                          {fmtPax(c.passagiers)} pax
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
