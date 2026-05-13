"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { VerrijktEvent } from "@/lib/analytics";
import type { DrukLevel } from "@/lib/drukte";
import { drukteLabel, DRUKTE_GRENS } from "@/lib/drukte";
import type { Bedrijf } from "@/lib/sumup";
import { useT } from "@/lib/i18n/useT";

interface Props {
  events: VerrijktEvent[];
  bedrijf: Bedrijf;
}

const drukStyle: Record<DrukLevel, { bg: string; border: string; tekst: string }> = {
  "zeer druk": { bg: "bg-red-50",     border: "border-red-200",     tekst: "text-red-700" },
  druk:        { bg: "bg-orange-50",  border: "border-orange-200",  tekst: "text-orange-700" },
  normaal:     { bg: "bg-sky-50",     border: "border-sky-200",     tekst: "text-sky-700" },
  laag:        { bg: "bg-emerald-50", border: "border-emerald-200", tekst: "text-emerald-700" },
  gesloten:    { bg: "bg-slate-100",  border: "border-slate-300",   tekst: "text-slate-500" },
};

function fmtEur(n: number): string {
  return `€${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
}

export default function FeestdagenKalender({ events, bedrijf }: Props) {
  const { t } = useT();
  if (events.length === 0) return null;

  const lijst = events.slice(0, 10);
  const g = DRUKTE_GRENS[bedrijf];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-slate-700">
          {t("holidays.title")}
        </h3>
        <span className="text-[11px] text-slate-400">
          {t("holidays.region")}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        {t("holidays.busy_legend")
          .replace("{normaal}", fmtEur(g.normaal))
          .replace("{druk}", fmtEur(g.druk))
          .replace("{zeerDruk}", fmtEur(g.zeerDruk))}
      </p>

      <div className="space-y-1.5">
        {lijst.map((e, i) => {
          const stijl = drukStyle[e.drukte];
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
                    ? t("holidays.now")
                    : e.dagenVanNu === 1
                    ? t("holidays.tomorrow")
                    : t("holidays.in_x_days").replace("{n}", String(e.dagenVanNu))}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {e.bron === "dicht" ? (
                    "Gesloten"
                  ) : e.verwachteOmzet === null ? (
                    "Geen historische referentie beschikbaar"
                  ) : e.soort === "vakantie" && e.verwachteOmzetPerDag ? (
                    <>
                      Vorig jaar: gem. {fmtEur(e.verwachteOmzetPerDag)}/dag
                      {e.minPerDag != null && e.maxPerDag != null && (
                        <>
                          {" "}(min {fmtEur(e.minPerDag)} · max {fmtEur(e.maxPerDag)})
                        </>
                      )}
                      {e.dagenGemeten != null && e.dagenDrukOfHoger != null && (
                        <>
                          {" · "}
                          {e.dagenDrukOfHoger} van {e.dagenGemeten} dagen druk
                          of hoger
                        </>
                      )}
                    </>
                  ) : (
                    `Verwacht ${fmtEur(e.verwachteOmzet)}${e.bron === "vorig-jaar" ? " (vorig jaar)" : " (gem. weekdag)"}`
                  )}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold ${stijl.tekst}`}
                >
                  {drukteLabel(e.drukte)}
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
