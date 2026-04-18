"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { JaarOmzet } from "@/lib/zettle-excel";

interface Props {
  data: JaarOmzet[];
  hex: string;
  huidigJaar?: number;
  huidigJaarOmzet?: number;
}

export default function HistorischOverzicht({ data, hex, huidigJaar, huidigJaarOmzet }: Props) {
  if (data.length === 0) return null;

  // Combineer Zettle historisch + huidig SumUp jaar
  const alles = [...data];
  if (huidigJaar && huidigJaarOmzet && huidigJaarOmzet > 0) {
    const bestaatAl = alles.find((d) => d.jaar === huidigJaar);
    if (!bestaatAl) {
      alles.push({
        jaar: huidigJaar,
        omzetInclBtw: huidigJaarOmzet,
        aantalTransacties: 0,
        gemiddeldeBon: 0,
        bron: "zettle",
      });
    }
  }

  const max = Math.max(...alles.map((d) => d.omzetInclBtw));
  const huidig = new Date().getFullYear();

  return (
    <div className="card">
      <h3 className="font-semibold mb-1 text-white/80">Historisch jaaroverzicht (Zettle)</h3>
      <p className="text-white/30 text-xs mb-4">Omzet inclusief BTW per jaar</p>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={alles} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="jaar"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
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
            }}
            formatter={(value: number) => [
              `€${value.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
              "Omzet incl. BTW",
            ]}
          />
          <Bar dataKey="omzetInclBtw" radius={[6, 6, 0, 0]}>
            {alles.map((entry, i) => (
              <Cell
                key={i}
                fill={hex}
                fillOpacity={entry.jaar === huidig ? 0.5 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Kaarten per jaar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {alles.map((d) => (
          <div key={d.jaar} className="bg-white/5 rounded-xl p-3">
            <p className="text-white/40 text-xs mb-1">
              {d.jaar}{d.jaar === huidig ? " (lopend)" : ""}
            </p>
            <p className="font-bold text-lg">
              €{(d.omzetInclBtw / 1000).toFixed(1)}k
            </p>
            {d.aantalTransacties > 0 && (
              <p className="text-white/30 text-xs mt-0.5">
                {d.aantalTransacties.toLocaleString("nl-NL")} tx · gem. €{d.gemiddeldeBon}
              </p>
            )}
            {d.jaar > (alles[0]?.jaar ?? 0) && (() => {
              const vorig = alles.find((x) => x.jaar === d.jaar - 1);
              if (!vorig) return null;
              const groei = ((d.omzetInclBtw - vorig.omzetInclBtw) / vorig.omzetInclBtw) * 100;
              return (
                <p className={`text-xs mt-1 ${groei >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {groei >= 0 ? "+" : ""}{groei.toFixed(1)}% vs {vorig.jaar}
                </p>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
