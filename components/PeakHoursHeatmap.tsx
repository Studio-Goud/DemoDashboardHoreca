"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { UurData } from "@/lib/analytics";

interface Props {
  data: UurData[];
  hex: string;
}

export default function PeakHoursHeatmap({ data, hex }: Props) {
  const max = Math.max(...data.map((d) => d.gemiddeld));

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-slate-700">Piekuren (gemiddeld per uur)</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [`€${value.toFixed(2)}`, "Gem. omzet"]}
          />
          <Bar dataKey="gemiddeld" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              const intensity = max > 0 ? entry.gemiddeld / max : 0;
              return (
                <Cell
                  key={index}
                  fill={hex}
                  fillOpacity={0.2 + intensity * 0.8}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
