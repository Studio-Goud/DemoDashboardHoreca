"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  format,
  parseISO,
  startOfYear,
  subYears,
  subDays,
  isLeapYear,
} from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo, useState } from "react";
import type { DagOmzet } from "@/lib/analytics";

interface Props {
  data: DagOmzet[];
  kleur: string;
  hex: string;
}

type Range = "14" | "30" | "60" | "90" | "365" | "ytd" | "all";
type Vergelijk = "geen" | "vorig-jaar" | "twee-jaar" | "vorige-periode";

const RANGES: { key: Range; label: string }[] = [
  { key: "14", label: "14d" },
  { key: "30", label: "30d" },
  { key: "60", label: "60d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1j" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "Alles" },
];

const VERGELIJK_OPTIES: { key: Vergelijk; label: string }[] = [
  { key: "geen", label: "Geen vergelijking" },
  { key: "vorig-jaar", label: "Vorig jaar zelfde dag" },
  { key: "twee-jaar", label: "2 jaar terug" },
  { key: "vorige-periode", label: "Vorige periode (zelfde lengte)" },
];

function rollingAverage(data: number[], window: number): number[] {
  return data.map((_, i) => {
    const van = Math.max(0, i - window + 1);
    const slice = data.slice(van, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function shiftDatum(datum: string, vergelijk: Vergelijk, periodeLengte: number): string | null {
  const d = parseISO(datum);
  switch (vergelijk) {
    case "vorig-jaar":
      return format(subYears(d, 1), "yyyy-MM-dd");
    case "twee-jaar":
      return format(subYears(d, 2), "yyyy-MM-dd");
    case "vorige-periode":
      return format(subDays(d, periodeLengte), "yyyy-MM-dd");
    default:
      return null;
  }
}

export default function RevenueChart({ data, kleur, hex }: Props) {
  const [range, setRange] = useState<Range>("60");
  const [vergelijk, setVergelijk] = useState<Vergelijk>("vorig-jaar");

  const zichtbaar = useMemo(() => {
    if (range === "all") return data;
    if (range === "ytd") {
      const begin = format(startOfYear(new Date()), "yyyy-MM-dd");
      return data.filter((d) => d.datum >= begin);
    }
    const n = parseInt(range, 10);
    return data.slice(-n);
  }, [data, range]);

  // Lookup-map (O(1) toegang per datum) — gebruikt voor elke vergelijkings-modus
  const omzetIndex = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data) m.set(d.datum, d.omzet);
    return m;
  }, [data]);

  const periodeLengte = zichtbaar.length;
  const heeftVergelijk = vergelijk !== "geen";
  const vergelijkLabel =
    VERGELIJK_OPTIES.find((o) => o.key === vergelijk)?.label ?? "";

  const omzetten = zichtbaar.map((d) => d.omzet);
  const gemiddeld =
    omzetten.length > 0
      ? omzetten.reduce((a, b) => a + b, 0) / omzetten.length
      : 0;
  const rolling = rollingAverage(omzetten, 7);

  const totaal = omzetten.reduce((a, b) => a + b, 0);
  const totaalTx = zichtbaar.reduce((s, d) => s + d.aantalTransacties, 0);
  const beste = zichtbaar.reduce(
    (a, b) => (a.omzet > b.omzet ? a : b),
    zichtbaar[0] ?? { datum: "", omzet: 0, aantalTransacties: 0 }
  );

  // Vergelijkings-totaal (zelfde aantal dagen, op basis van geselecteerde modus)
  const vorigTotaal = heeftVergelijk
    ? zichtbaar.reduce((s, d) => {
        const key = shiftDatum(d.datum, vergelijk, periodeLengte);
        return s + (key ? omzetIndex.get(key) ?? 0 : 0);
      }, 0)
    : 0;
  const heeftVorig = vorigTotaal > 0;
  const groeiPct =
    vorigTotaal > 0
      ? Math.round(((totaal - vorigTotaal) / vorigTotaal) * 1000) / 10
      : null;

  const formatted = zichtbaar.map((d, i) => {
    const vergelijkKey = shiftDatum(d.datum, vergelijk, periodeLengte);
    const vergelijkOmzet = vergelijkKey
      ? omzetIndex.get(vergelijkKey)
      : undefined;
    return {
      ...d,
      label: format(parseISO(d.datum), "dd-MM", { locale: nl }),
      voljaar: format(parseISO(d.datum), "EEEE dd-MM-yyyy", { locale: nl }),
      trend: Math.round(rolling[i] * 100) / 100,
      vorig:
        vergelijkOmzet !== undefined
          ? Math.round(vergelijkOmzet * 100) / 100
          : null,
      vorigDatum: vergelijkKey
        ? format(parseISO(vergelijkKey), "dd-MM-yyyy")
        : null,
    };
  });

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Omzet per dag</h3>
          <p className="text-[11px] text-slate-400">
            {zichtbaar.length > 0 &&
              `${format(parseISO(zichtbaar[0].datum), "dd-MM-yyyy", {
                locale: nl,
              })} – ${format(parseISO(zichtbaar[zichtbaar.length - 1].datum), "dd-MM-yyyy", { locale: nl })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                range === r.key
                  ? "bg-slate-200 text-slate-900"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
          <select
            value={vergelijk}
            onChange={(e) => setVergelijk(e.target.value as Vergelijk)}
            className="ml-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-700 focus:outline-none"
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
              vergelijk: €{vorigTotaal.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
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
            Beste dag
          </p>
          <p className="text-sm font-semibold tabular-nums">
            €{beste.omzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-slate-400">
            {beste.datum &&
              format(parseISO(beste.datum), "dd-MM-yyyy", { locale: nl })}
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
            gem. €{gemiddeld.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}/dag
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={formatted}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id={`grad-${kleur}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={hex} stopOpacity={0.5} />
              <stop offset="95%" stopColor={hex} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(15,23,42,0.08)"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(formatted.length / 8))}
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
                  `€${value.toFixed(2)} · ${item.payload.aantalTransacties} tx`,
                  "Omzet dit jaar",
                ];
              if (name === "vorig") {
                const datum = (item.payload as { vorigDatum?: string | null })
                  ?.vorigDatum;
                return [
                  `€${value.toFixed(2)}`,
                  datum ? `${vergelijkLabel} (${datum})` : vergelijkLabel,
                ];
              }
              return [`€${value.toFixed(2)}`, "7-daags gem."];
            }}
            labelFormatter={(_l, items) =>
              (items?.[0]?.payload as { voljaar?: string })?.voljaar ?? ""
            }
          />
          {gemiddeld > 0 && (
            <ReferenceLine
              y={gemiddeld}
              stroke="rgba(15,23,42,0.35)"
              strokeDasharray="4 4"
            />
          )}
          {heeftVergelijk && heeftVorig && (
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
          <Line
            type="monotone"
            dataKey="trend"
            stroke="rgba(15,23,42,0.8)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="5 3"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ backgroundColor: hex }}
          />
          dit jaar
        </span>
        {heeftVergelijk && heeftVorig && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-[2px] bg-slate-400" />
            {vergelijkLabel.toLowerCase()}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-[2px] bg-slate-800"
            style={{ borderTop: "2px dashed" }}
          />
          7-daags voortschrijdend gemiddelde
        </span>
      </div>
    </div>
  );
}
