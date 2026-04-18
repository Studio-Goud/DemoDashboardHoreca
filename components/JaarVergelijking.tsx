"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MaandOmzet } from "@/lib/analytics";

interface Props {
  data: MaandOmzet[];
  hex: string;
}

const MAAND_LABELS = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

export default function JaarVergelijking({ data, hex }: Props) {
  if (data.length === 0) return null;

  const jaren = Array.from(new Set(data.map((d) => d.jaar))).sort();

  // Bouw per-maand rij met kolom per jaar
  const rows = MAAND_LABELS.map((label, i) => {
    const rij: Record<string, number | string> = { maand: label };
    for (const j of jaren) {
      const cel = data.find((d) => d.jaar === j && d.maand === i + 1);
      rij[String(j)] = cel ? cel.omzet : 0;
    }
    return rij;
  });

  // Totaal per jaar (voor samenvatting)
  const jaarTotaal = new Map<number, { omzet: number; txs: number }>();
  for (const d of data) {
    const cur = jaarTotaal.get(d.jaar) ?? { omzet: 0, txs: 0 };
    cur.omzet += d.omzet;
    cur.txs += d.txs;
    jaarTotaal.set(d.jaar, cur);
  }

  const kleuren = [
    "rgba(255,255,255,0.25)",
    "rgba(255,255,255,0.45)",
    "rgba(255,255,255,0.65)",
    hex,
  ];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-white/80">
          Maand-op-maand vergelijking
        </h3>
        <span className="text-[11px] text-white/30">
          Huidige data · alle jaren
        </span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
          <XAxis
            dataKey="maand"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name) => [
              `€${value.toLocaleString("nl-NL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              String(name),
            ]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}
          />
          {jaren.map((j, idx) => (
            <Line
              key={j}
              type="monotone"
              dataKey={String(j)}
              stroke={
                idx === jaren.length - 1
                  ? hex
                  : kleuren[Math.min(idx, kleuren.length - 2)]
              }
              strokeWidth={idx === jaren.length - 1 ? 2.5 : 1.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {jaren.map((j) => {
          const t = jaarTotaal.get(j)!;
          return (
            <div key={j} className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs">{j}</p>
              <p className="font-bold text-lg tabular-nums">
                €{(t.omzet / 1000).toFixed(1)}k
              </p>
              <p className="text-[11px] text-white/30">
                {t.txs.toLocaleString("nl-NL")} tx
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
