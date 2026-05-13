"use client";

import { format, parseISO, isToday } from "date-fns";
import { nl, enUS, pt } from "date-fns/locale";
import type { Prognose } from "@/lib/analytics";
import type { DrukLevel } from "@/lib/drukte";
import { DRUKTE_GRENS } from "@/lib/drukte";
import type { Bedrijf } from "@/lib/sumup";
import { useT } from "@/lib/i18n/useT";
import type { Taal } from "@/lib/i18n/dictionaries";

const LOCALE_PER_TAAL: Record<Taal, typeof nl> = { nl, en: enUS, pt };

const DRUK_KEY: Record<DrukLevel, string> = {
  laag:        "drukte.quiet",
  normaal:     "drukte.normal",
  druk:        "drukte.busy",
  "zeer druk": "drukte.very_busy",
  gesloten:    "drukte.closed",
};

const DAG_AFK_PER_TAAL: Record<Taal, string[]> = {
  nl: ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
};

interface CruiseHint {
  datum: string;
  totaalPassagiers: number;
  aantal: number;
}

interface WeerHint {
  datum: string;
  tempMax: number;
  tempMin: number;
  neerslag: number;
  emoji: string;
  categorie: string;
}

interface Props {
  data: Prognose[];
  omzetVandaag: number;
  bedrijf: Bedrijf;
  cruises?: CruiseHint[];
  weer?: WeerHint[];
}

const drukStyle: Record<DrukLevel, { bar: string; text: string }> = {
  laag:        { bar: "#E2E8F0", text: "text-slate-500" },
  normaal:     { bar: "#BAE6FD", text: "text-sky-700" },
  druk:        { bar: "#FDBA74", text: "text-orange-700" },
  "zeer druk": { bar: "#FCA5A5", text: "text-red-700" },
  gesloten:    { bar: "#CBD5E1", text: "text-slate-500" },
};

export default function Forecast({ data, omzetVandaag, bedrijf, cruises = [], weer = [] }: Props) {
  const { t, taal } = useT();
  const dateLocale = LOCALE_PER_TAAL[taal] ?? nl;
  const DAG_AFK = DAG_AFK_PER_TAAL[taal] ?? DAG_AFK_PER_TAAL.nl;
  if (data.length === 0) return null;

  const g = DRUKTE_GRENS[bedrijf];
  const cruiseMap = new Map<string, CruiseHint>();
  for (const c of cruises) cruiseMap.set(c.datum, c);
  const weerMap = new Map<string, WeerHint>();
  for (const w of weer) weerMap.set(w.datum, w);

  const totaalVerwacht = data.reduce((s, p) => s + p.verwacht, 0);
  const bruikbaarheid = data.filter((d) => d.verwacht > 0).length;
  const druksteDag =
    data.reduce<Prognose | null>(
      (a, b) => (!a || b.verwacht > a.verwacht ? b : a),
      null
    );
  const maxVerwacht = druksteDag?.verwacht ?? 0;

  if (totaalVerwacht === 0 || bruikbaarheid < 3) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-1 text-slate-700">{t("forecast.title")}</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          {t("forecast.no_history")}
        </p>
      </div>
    );
  }

  // Groepeer per week voor overzichtelijker layout
  const weken: Prognose[][] = [];
  for (let i = 0; i < data.length; i += 7) weken.push(data.slice(i, i + 7));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-700">{t("forecast.title")}</h3>
          <p className="text-[11px] text-slate-400">
            {t("forecast.subtitle")
              .replace("{druk}", String(g.druk))
              .replace("{zeerDruk}", String(g.zeerDruk))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            {t("forecast.expected_total")}
          </p>
          <p className="font-bold text-lg tabular-nums text-slate-900">
            €{totaalVerwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {weken.map((week, wi) => (
          <div key={wi} className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              {wi === 0 ? t("forecast.this_week_from_today") : t("forecast.next_week")}
            </p>
            {week.map((dag) => {
              const datum = parseISO(dag.datum);
              const vandaag = isToday(datum);
              const realisatie =
                vandaag && dag.verwacht > 0
                  ? Math.round((omzetVandaag / dag.verwacht) * 100)
                  : null;
              const stijl = drukStyle[dag.druk];
              const pct = maxVerwacht > 0 ? (dag.verwacht / maxVerwacht) * 100 : 0;
              return (
                <div
                  key={dag.datum}
                  className={`grid grid-cols-[minmax(120px,1.3fr)_3fr_minmax(100px,auto)] items-center gap-3 py-2 px-3 rounded-lg ${
                    vandaag
                      ? "bg-slate-100 border border-slate-300"
                      : "hover:bg-slate-50"
                  } transition-colors`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="inline-block w-7 text-slate-400">
                        {DAG_AFK[dag.weekdag]}
                      </span>
                      {format(datum, "dd-MM", { locale: dateLocale })}
                      {vandaag && (
                        <span className="ml-2 text-[10px] text-slate-500 font-normal">
                          {t("forecast.today_label")}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {weerMap.get(dag.datum) && (
                        <span
                          className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-1.5 rounded"
                          title={t("forecast.weather_tooltip")
                            .replace("{categorie}", weerMap.get(dag.datum)!.categorie)
                            .replace("{temp}", String(Math.round(weerMap.get(dag.datum)!.tempMax)))
                            .replace("{neerslag}", weerMap.get(dag.datum)!.neerslag.toFixed(1))}
                        >
                          {weerMap.get(dag.datum)!.emoji}{" "}
                          {Math.round(weerMap.get(dag.datum)!.tempMax)}°
                        </span>
                      )}
                      {dag.feestdag && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded">
                          {dag.feestdag}
                        </span>
                      )}
                      {!dag.feestdag && dag.vakantie && (
                        <span className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 rounded">
                          {dag.vakantie}
                        </span>
                      )}
                      {cruiseMap.get(dag.datum) && (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 rounded">
                          🛳 {cruiseMap.get(dag.datum)!.totaalPassagiers.toLocaleString("nl-NL")} {t("forecast.pax_suffix")}
                        </span>
                      )}
                      <span className={`text-[10px] ${stijl.text}`}>
                        {t(DRUK_KEY[dag.druk])}
                      </span>
                    </div>
                  </div>

                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: stijl.bar,
                      }}
                    />
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      €{dag.verwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                    </p>
                    {vandaag && realisatie !== null && (
                      <p
                        className={`text-[10px] tabular-nums ${
                          realisatie >= 100
                            ? "text-emerald-600"
                            : "text-orange-600"
                        }`}
                      >
                        {t("forecast.now_label")
                          .replace("{pct}", String(realisatie))
                          .replace("{bedrag}", "€" + omzetVandaag.toLocaleString("nl-NL", { maximumFractionDigits: 0 }))}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {druksteDag && (
        <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
          {t("forecast.busiest_day")}{" "}
          <span className="text-slate-700 font-medium">
            {format(parseISO(druksteDag.datum), "EEEE dd-MM-yyyy", { locale: dateLocale })}
          </span>{" "}
          · ~€{druksteDag.verwacht.toFixed(0)}
        </p>
      )}
    </div>
  );
}
