"use client";

import { format, parseISO } from "date-fns";
import { nl, enUS, pt } from "date-fns/locale";
import type { CruiseDag, CruiseImpact } from "@/lib/cruises";
import { useT } from "@/lib/i18n/useT";
import type { Taal } from "@/lib/i18n/dictionaries";

interface Props {
  dagen: CruiseDag[];
}

const impactStijl: Record<CruiseImpact, { bg: string; border: string; tekst: string; dot: string }> = {
  hoog:     { bg: "bg-red-50",     border: "border-red-200",     tekst: "text-red-700",     dot: "bg-red-500" },
  middel:   { bg: "bg-orange-50",  border: "border-orange-200",  tekst: "text-orange-700",  dot: "bg-orange-500" },
  laag:     { bg: "bg-sky-50",     border: "border-sky-200",     tekst: "text-sky-700",     dot: "bg-sky-500" },
  minimaal: { bg: "bg-slate-50",   border: "border-slate-200",   tekst: "text-slate-500",   dot: "bg-slate-400" },
};

const IMPACT_KEY: Record<CruiseImpact, string> = {
  hoog:     "cruises.impact_hoog",
  middel:   "cruises.impact_middel",
  laag:     "cruises.impact_laag",
  minimaal: "cruises.impact_minimaal",
};

const LOCALE_PER_TAAL: Record<Taal, typeof nl> = {
  nl, en: enUS, pt,
};

function fmtPax(n: number): string {
  return n.toLocaleString("nl-NL");
}

export default function CruiseAgenda({ dagen }: Props) {
  const { t, taal } = useT();
  const dateLocale = LOCALE_PER_TAAL[taal] ?? nl;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-slate-700">
          {t("cruises.title")}
        </h3>
        <span className="text-[11px] text-slate-400">
          {t("cruises.source")}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        {t("cruises.intro")}
      </p>

      {dagen.length === 0 ? (
        <p className="text-slate-400 text-sm">
          {t("cruises.none")}
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
                      {format(parseISO(dag.datum), "EEE", { locale: dateLocale })}
                    </p>
                    <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">
                      {format(parseISO(dag.datum), "dd", { locale: dateLocale })}
                    </p>
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      {format(parseISO(dag.datum), "MM", { locale: dateLocale })}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${stijl.tekst}`}>
                      {t("cruises.line")
                        .replace("{n}", String(dag.cruises.length))
                        .replace("{pax}", fmtPax(dag.totaalPassagiers))}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {dag.dagenVanNu <= 0
                        ? t("cruises.today")
                        : dag.dagenVanNu === 1
                        ? t("cruises.tomorrow")
                        : t("cruises.in_days").replace("{n}", String(dag.dagenVanNu))}
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
                        {t(IMPACT_KEY[dag.piekImpact])}
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
                          {fmtPax(c.passagiers)} {t("cruises.pax_suffix")}
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
