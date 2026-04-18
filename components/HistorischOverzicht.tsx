"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { JaarOmzet } from "@/lib/zettle-excel";

interface Props {
  data: JaarOmzet[];
  hex: string;
  huidigJaar?: number;
  huidigJaarOmzet?: number;    // SumUp YTD
  huidigJaarTx?: number;        // SumUp YTD
}

function fmtEur(n: number): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtK(n: number): string {
  return `€${(n / 1000).toFixed(1)}k`;
}

export default function HistorischOverzicht({
  data,
  hex,
  huidigJaar,
  huidigJaarOmzet,
  huidigJaarTx,
}: Props) {
  if (data.length === 0 && !(huidigJaar && huidigJaarOmzet)) return null;

  // Voeg huidig jaar (SumUp) toe als het ontbreekt in Zettle-data
  const alles = [...data];
  if (
    huidigJaar &&
    huidigJaarOmzet &&
    huidigJaarOmzet > 0 &&
    !alles.some((d) => d.jaar === huidigJaar)
  ) {
    alles.push({
      jaar: huidigJaar,
      omzetInclBtw: huidigJaarOmzet,
      omzetExclBtw: 0,
      btw: 0,
      aantalTransacties: huidigJaarTx ?? 0,
      gemiddeldeBon:
        huidigJaarTx && huidigJaarTx > 0
          ? Math.round((huidigJaarOmzet / huidigJaarTx) * 100) / 100
          : 0,
      itemsPerBon: 0,
      omzetPos: 0,
      omzetContant: 0,
      kortingen: 0,
      bron: "zettle",
    });
    alles.sort((a, b) => a.jaar - b.jaar);
  }

  const huidig = new Date().getFullYear();

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-slate-700">Historisch jaaroverzicht</h3>
        <span className="text-[11px] text-slate-400">
          Bron: Zettle verkooprapport ({alles.filter((d) => d.aantalTransacties > 0).length}× jaar) · huidig jaar via SumUp
        </span>
      </div>
      <p className="text-slate-400 text-xs mb-4">
        Omzet inclusief BTW · {alles.length} jaren
      </p>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={alles} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
          <XAxis
            dataKey="jaar"
            tick={{ fill: "rgba(15,23,42,0.6)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [
              `€${fmtEur(value)}`,
              "Omzet incl. BTW",
            ]}
          />
          <Bar dataKey="omzetInclBtw" radius={[6, 6, 0, 0]}>
            {alles.map((entry, i) => (
              <Cell
                key={i}
                fill={hex}
                fillOpacity={entry.jaar === huidig ? 0.45 : 0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
        {alles.map((d, idx) => {
          const vorig = alles[idx - 1];
          const groei =
            vorig && vorig.omzetInclBtw > 0
              ? ((d.omzetInclBtw - vorig.omzetInclBtw) / vorig.omzetInclBtw) * 100
              : null;
          return (
            <div key={d.jaar} className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-slate-400 text-xs">
                  {d.jaar}
                  {d.jaar === huidig ? " (YTD)" : ""}
                </p>
                {groei !== null && (
                  <span
                    className={`text-[10px] ${
                      groei >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {groei >= 0 ? "+" : ""}
                    {groei.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="font-bold text-lg tabular-nums">
                {fmtK(d.omzetInclBtw)}
              </p>
              {d.aantalTransacties > 0 && (
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {d.aantalTransacties.toLocaleString("nl-NL")} tx · gem. €
                  {d.gemiddeldeBon.toFixed(2)}
                </p>
              )}
              {d.omzetPos > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Kaart</span>
                    <span className="tabular-nums">
                      {fmtK(d.omzetPos)} ·{" "}
                      {Math.round(
                        (d.omzetPos / (d.omzetPos + d.omzetContant)) * 100
                      )}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contant</span>
                    <span className="tabular-nums">
                      {fmtK(d.omzetContant)}
                    </span>
                  </div>
                  {d.kortingen > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Kortingen</span>
                      <span className="tabular-nums">
                        −€{Math.round(d.kortingen).toLocaleString("nl-NL")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
