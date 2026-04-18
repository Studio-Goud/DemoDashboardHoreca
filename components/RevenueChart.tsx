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
} from "recharts";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo, useState } from "react";
import type { DagOmzet } from "@/lib/analytics";

interface Props {
  data: DagOmzet[];
  kleur: string;
  hex: string;
}

type Range = "14" | "30" | "60" | "90" | "365" | "all";

const RANGES: { key: Range; label: string }[] = [
  { key: "14", label: "14d" },
  { key: "30", label: "30d" },
  { key: "60", label: "60d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1j" },
  { key: "all", label: "Alles" },
];

function rollingAverage(data: number[], window: number): number[] {
  return data.map((_, i) => {
    const van = Math.max(0, i - window + 1);
    const slice = data.slice(van, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export default function RevenueChart({ data, kleur, hex }: Props) {
  const [range, setRange] = useState<Range>("60");

  const zichtbaar = useMemo(() => {
    if (range === "all") return data;
    const n = parseInt(range, 10);
    return data.slice(-n);
  }, [data, range]);

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
  const slechtste = zichtbaar
    .filter((d) => d.omzet > 0)
    .reduce(
      (a, b) => (a.omzet < b.omzet ? a : b),
      zichtbaar.find((d) => d.omzet > 0) ?? {
        datum: "",
        omzet: 0,
        aantalTransacties: 0,
      }
    );

  const formatted = zichtbaar.map((d, i) => ({
    ...d,
    label: format(parseISO(d.datum), "d MMM", { locale: nl }),
    voljaar: format(parseISO(d.datum), "d MMM yyyy", { locale: nl }),
    trend: Math.round(rolling[i] * 100) / 100,
  }));

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Omzet per dag</h3>
          <p className="text-[11px] text-slate-400">
            {zichtbaar.length > 0 &&
              `${format(parseISO(zichtbaar[0].datum), "d MMM yyyy", {
                locale: nl,
              })} – ${format(parseISO(zichtbaar[zichtbaar.length - 1].datum), "d MMM yyyy", { locale: nl })}`}
          </p>
        </div>
        <div className="flex gap-1">
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
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            Gem. per dag
          </p>
          <p className="text-sm font-semibold tabular-nums">
            €{gemiddeld.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
          </p>
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
              format(parseISO(beste.datum), "d MMM", { locale: nl })}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            Transacties
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {totaalTx.toLocaleString("nl-NL")}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
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
                  "Omzet",
                ];
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
              label={{
                value: `gem. €${gemiddeld.toFixed(0)}`,
                fill: "rgba(15,23,42,0.6)",
                fontSize: 10,
                position: "right",
              }}
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

      <p className="text-[10px] text-slate-400 mt-2">
        Doorlopende lijn = daadwerkelijke omzet · stippellijn = 7-daags
        voortschrijdend gemiddelde
      </p>
    </div>
  );
}
