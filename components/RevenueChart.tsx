"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import type { DagOmzet } from "@/lib/analytics";

interface Props {
  data: DagOmzet[];
  kleur: string;
  hex: string;
}

export default function RevenueChart({ data, kleur, hex }: Props) {
  const recent = data.slice(-60);

  const formatted = recent.map((d) => ({
    ...d,
    label: format(parseISO(d.datum), "d MMM", { locale: nl }),
  }));

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-white/80">Omzet per dag (laatste 60 dagen)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`grad-${kleur}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={hex} stopOpacity={0.4} />
              <stop offset="95%" stopColor={hex} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={9}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [`€${value.toFixed(2)}`, "Omzet"]}
          />
          <Area
            type="monotone"
            dataKey="omzet"
            stroke={hex}
            strokeWidth={2}
            fill={`url(#grad-${kleur})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
