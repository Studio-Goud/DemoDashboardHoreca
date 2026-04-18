"use client";

import {
  ComposedChart,
  BarChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  format,
  parseISO,
  subYears,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  getQuarter,
  addWeeks,
  addMonths,
  addQuarters,
  addDays,
  differenceInDays,
  isAfter,
  isBefore,
  isSameDay,
} from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo, useState } from "react";
import type { DagOmzet } from "@/lib/analytics";

interface Props {
  data: DagOmzet[];
  kleur: string;
  hex: string;
}

type Aggregatie = "dag" | "week" | "tweeweek" | "maand" | "kwartaal" | "jaar";
type Vergelijk = "geen" | "vorig-jaar" | "twee-jaar" | "vorige-periode";

const AGGREGATIES: { key: Aggregatie; label: string; default: number }[] = [
  { key: "dag", label: "Per dag", default: 60 },
  { key: "week", label: "Per week", default: 26 },
  { key: "tweeweek", label: "Per 14 dagen", default: 26 },
  { key: "maand", label: "Per maand", default: 24 },
  { key: "kwartaal", label: "Per kwartaal", default: 12 },
  { key: "jaar", label: "Per jaar", default: 99 },
];

const VERGELIJK_OPTIES: { key: Vergelijk; label: string }[] = [
  { key: "geen", label: "Geen vergelijking" },
  { key: "vorig-jaar", label: "Vorig jaar zelfde periode" },
  { key: "twee-jaar", label: "2 jaar terug" },
  { key: "vorige-periode", label: "Vorige periode (zelfde lengte)" },
];

interface Bucket {
  key: string;              // sleutel voor lookup
  begin: Date;
  eind: Date;
  label: string;            // korte label voor x-as
  subLabel: string;         // voljaar-label voor tooltip
  omzet: number;
  tx: number;
}

// Bepaal bucket voor een dag op basis van aggregatie
function bucketVoor(d: Date, agg: Aggregatie): { key: string; begin: Date; eind: Date } {
  switch (agg) {
    case "dag":
      return {
        key: format(d, "yyyy-MM-dd"),
        begin: d,
        eind: d,
      };
    case "week": {
      const b = startOfWeek(d, { weekStartsOn: 1 });
      return {
        key: format(b, "yyyy-'W'II"),
        begin: b,
        eind: endOfWeek(d, { weekStartsOn: 1 }),
      };
    }
    case "tweeweek": {
      // Relatief aan een vaste anchor (1 jan 2023) zodat buckets consistent zijn
      const anchor = new Date(2023, 0, 2); // maandag
      const dagen = Math.floor(differenceInDays(d, anchor) / 14) * 14;
      const begin = addDays(anchor, dagen);
      const eind = addDays(begin, 13);
      return {
        key: format(begin, "yyyy-MM-dd") + "_2w",
        begin,
        eind,
      };
    }
    case "maand": {
      const b = startOfMonth(d);
      return {
        key: format(b, "yyyy-MM"),
        begin: b,
        eind: endOfMonth(b),
      };
    }
    case "kwartaal": {
      const b = startOfQuarter(d);
      return {
        key: `${b.getFullYear()}-Q${getQuarter(b)}`,
        begin: b,
        eind: endOfQuarter(b),
      };
    }
    case "jaar": {
      const b = startOfYear(d);
      return {
        key: String(b.getFullYear()),
        begin: b,
        eind: endOfYear(b),
      };
    }
  }
}

function bucketLabel(b: { begin: Date; eind: Date }, agg: Aggregatie): { kort: string; lang: string } {
  switch (agg) {
    case "dag":
      return {
        kort: format(b.begin, "dd-MM"),
        lang: format(b.begin, "EEEE dd-MM-yyyy", { locale: nl }),
      };
    case "week":
      return {
        kort: "w" + format(b.begin, "II"),
        lang: `Week ${format(b.begin, "II")} ${b.begin.getFullYear()} (${format(b.begin, "dd-MM")} t/m ${format(b.eind, "dd-MM")})`,
      };
    case "tweeweek":
      return {
        kort: format(b.begin, "dd-MM"),
        lang: `${format(b.begin, "dd-MM-yyyy")} t/m ${format(b.eind, "dd-MM-yyyy")}`,
      };
    case "maand":
      return {
        kort: format(b.begin, "MMM yy", { locale: nl }),
        lang: format(b.begin, "MMMM yyyy", { locale: nl }),
      };
    case "kwartaal":
      return {
        kort: `Q${getQuarter(b.begin)} ${b.begin.getFullYear()}`,
        lang: `${b.begin.getFullYear()} kwartaal ${getQuarter(b.begin)}`,
      };
    case "jaar":
      return {
        kort: String(b.begin.getFullYear()),
        lang: `Jaar ${b.begin.getFullYear()}`,
      };
  }
}

function aggregeer(data: DagOmzet[], agg: Aggregatie): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const d of data) {
    const dt = parseISO(d.datum);
    const { key, begin, eind } = bucketVoor(dt, agg);
    const bestaand = map.get(key);
    if (bestaand) {
      bestaand.omzet += d.omzet;
      bestaand.tx += d.aantalTransacties;
    } else {
      const labels = bucketLabel({ begin, eind }, agg);
      map.set(key, {
        key,
        begin,
        eind,
        label: labels.kort,
        subLabel: labels.lang,
        omzet: d.omzet,
        tx: d.aantalTransacties,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.begin.getTime() - b.begin.getTime()
  );
}

function shiftBucket(
  b: Bucket,
  vergelijk: Vergelijk,
  aggregatie: Aggregatie,
  periodeLengte: number
): { begin: Date; eind: Date } | null {
  switch (vergelijk) {
    case "vorig-jaar":
      return { begin: subYears(b.begin, 1), eind: subYears(b.eind, 1) };
    case "twee-jaar":
      return { begin: subYears(b.begin, 2), eind: subYears(b.eind, 2) };
    case "vorige-periode": {
      const shiftDagen = (() => {
        switch (aggregatie) {
          case "dag": return periodeLengte;
          case "week": return periodeLengte * 7;
          case "tweeweek": return periodeLengte * 14;
          case "maand": return periodeLengte * 30;
          case "kwartaal": return periodeLengte * 91;
          case "jaar": return periodeLengte * 365;
        }
      })();
      return {
        begin: subDays(b.begin, shiftDagen),
        eind: subDays(b.eind, shiftDagen),
      };
    }
    default:
      return null;
  }
}

export default function RevenueChart({ data, kleur, hex }: Props) {
  const [aggregatie, setAggregatie] = useState<Aggregatie>("dag");
  const [vergelijk, setVergelijk] = useState<Vergelijk>("vorig-jaar");

  const alleBuckets = useMemo(() => aggregeer(data, aggregatie), [
    data,
    aggregatie,
  ]);

  const aggConfig = AGGREGATIES.find((a) => a.key === aggregatie)!;
  const maxTonen = aggConfig.default;
  const zichtbaar = alleBuckets.slice(-maxTonen);

  // Voor vergelijking: vind vorige-periode-bucket voor elke zichtbare bucket
  const vergelijkOmzet = useMemo(() => {
    if (vergelijk === "geen") return new Map<string, number>();
    const m = new Map<string, number>();
    for (const b of zichtbaar) {
      const shift = shiftBucket(b, vergelijk, aggregatie, zichtbaar.length);
      if (!shift) continue;
      // Som alle dagen uit `data` die binnen de vergelijk-range vallen
      let som = 0;
      for (const d of data) {
        const dt = parseISO(d.datum);
        if (dt >= shift.begin && dt <= shift.eind) som += d.omzet;
      }
      m.set(b.key, som);
    }
    return m;
  }, [vergelijk, zichtbaar, data, aggregatie]);

  const totaal = zichtbaar.reduce((s, b) => s + b.omzet, 0);
  const totaalTx = zichtbaar.reduce((s, b) => s + b.tx, 0);
  const beste = zichtbaar.reduce(
    (a, b) => (a.omzet > b.omzet ? a : b),
    zichtbaar[0] ?? null
  );
  const gemiddeld =
    zichtbaar.length > 0 ? totaal / zichtbaar.length : 0;
  const vorigTotaal = Array.from(vergelijkOmzet.values()).reduce(
    (s, v) => s + v,
    0
  );
  const heeftVorig = vorigTotaal > 0;
  const groeiPct =
    vorigTotaal > 0
      ? Math.round(((totaal - vorigTotaal) / vorigTotaal) * 1000) / 10
      : null;

  const chartData = zichtbaar.map((b) => ({
    key: b.key,
    label: b.label,
    subLabel: b.subLabel,
    omzet: Math.round(b.omzet * 100) / 100,
    tx: b.tx,
    vorig: Math.round((vergelijkOmzet.get(b.key) ?? 0) * 100) / 100,
  }));

  const vergelijkLabel =
    VERGELIJK_OPTIES.find((o) => o.key === vergelijk)?.label ?? "";
  // Staafdiagram alleen voor per-jaar (weinig kolommen, dikke balken);
  // voor alle andere granulariteiten de Area+Line chart zodat je een
  // lijn-vergelijking krijgt.
  const gebruikBar = aggregatie === "jaar";

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Omzet</h3>
          <p className="text-[11px] text-slate-400">
            {zichtbaar.length > 0 &&
              `${format(zichtbaar[0].begin, "dd-MM-yyyy", { locale: nl })} – ${format(zichtbaar[zichtbaar.length - 1].eind, "dd-MM-yyyy", { locale: nl })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={aggregatie}
            onChange={(e) => setAggregatie(e.target.value as Aggregatie)}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-700 focus:outline-none"
          >
            {AGGREGATIES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={vergelijk}
            onChange={(e) => setVergelijk(e.target.value as Vergelijk)}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-700 focus:outline-none"
          >
            {VERGELIJK_OPTIES.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            Totaal
          </p>
          <p className="text-sm font-semibold tabular-nums">
            €{totaal.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
          </p>
          {heeftVorig && (
            <p className="text-[10px] text-slate-400 tabular-nums">
              vergelijk: €
              {vorigTotaal.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide truncate">
            vs {vergelijkLabel.toLowerCase()}
          </p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              groeiPct === null
                ? "text-slate-400"
                : groeiPct >= 0
                ? "text-emerald-600"
                : "text-red-500"
            }`}
          >
            {groeiPct === null
              ? "—"
              : `${groeiPct >= 0 ? "+" : ""}${groeiPct}%`}
          </p>
          {heeftVorig && groeiPct !== null && (
            <p className="text-[10px] text-slate-400 tabular-nums">
              {groeiPct >= 0 ? "+" : "−"}€
              {Math.abs(totaal - vorigTotaal).toLocaleString("nl-NL", {
                maximumFractionDigits: 0,
              })}
            </p>
          )}
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            Beste {aggConfig.label.toLowerCase().replace("per ", "")}
          </p>
          <p className="text-sm font-semibold tabular-nums">
            €
            {beste
              ? beste.omzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })
              : "0"}
          </p>
          <p className="text-[10px] text-slate-400">
            {beste ? beste.subLabel : ""}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            Transacties
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {totaalTx.toLocaleString("nl-NL")}
          </p>
          <p className="text-[10px] text-slate-400">
            gem. €
            {gemiddeld.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}/
            {aggregatie === "dag" ? "dag" : aggregatie}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {gebruikBar ? (
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(15,23,42,0.55)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={aggregatie === "jaar" ? 0 : "preserveStartEnd"}
            />
            <YAxis
              tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string, item) => {
                if (name === "omzet")
                  return [
                    `€${value.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${item.payload.tx} tx`,
                    "Omzet",
                  ];
                if (name === "vorig")
                  return [
                    `€${value.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}`,
                    vergelijkLabel,
                  ];
                return [value, name];
              }}
              labelFormatter={(_l, items) =>
                (items?.[0]?.payload as { subLabel?: string })?.subLabel ?? ""
              }
            />
            <Bar dataKey="omzet" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={hex} fillOpacity={0.85} />
              ))}
            </Bar>
            {vergelijk !== "geen" && heeftVorig && (
              <Bar
                dataKey="vorig"
                radius={[4, 4, 0, 0]}
                fill="#94A3B8"
                fillOpacity={0.7}
              />
            )}
          </BarChart>
        ) : (
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`grad-${kleur}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={hex} stopOpacity={0.5} />
                <stop offset="95%" stopColor={hex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 8))}
            />
            <YAxis
              tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string, item) => {
                if (name === "omzet")
                  return [
                    `€${value.toFixed(2)} · ${item.payload.tx} tx`,
                    "Omzet",
                  ];
                if (name === "vorig")
                  return [`€${value.toFixed(2)}`, vergelijkLabel];
                return [value, name];
              }}
              labelFormatter={(_l, items) =>
                (items?.[0]?.payload as { subLabel?: string })?.subLabel ?? ""
              }
            />
            {vergelijk !== "geen" && heeftVorig && (
              <Line
                type="monotone"
                dataKey="vorig"
                stroke="#94A3B8"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            <Area
              type="monotone"
              dataKey="omzet"
              stroke={hex}
              strokeWidth={1.8}
              fill={`url(#grad-${kleur})`}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ backgroundColor: hex }}
          />
          {aggConfig.label.toLowerCase()}
        </span>
        {vergelijk !== "geen" && heeftVorig && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-slate-400" />
            {vergelijkLabel.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}
