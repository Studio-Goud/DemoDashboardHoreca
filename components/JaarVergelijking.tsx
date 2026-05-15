"use client";

import { useState } from "react";
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
import DetailSheet from "./sf/DetailSheet";

interface Props {
  data: MaandOmzet[];
  hex: string;
}

const MAAND_LABELS = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

export default function JaarVergelijking({ data, hex }: Props) {
  const [actiefJaar, setActiefJaar] = useState<number | null>(null);
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
    "rgba(15,23,42,0.25)",
    "rgba(15,23,42,0.4)",
    "rgba(15,23,42,0.55)",
    hex,
  ];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-slate-700">
          Maand-op-maand vergelijking
        </h3>
        <span className="text-[11px] text-slate-400">
          Huidige data · alle jaren
        </span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(15,23,42,0.08)"
          />
          <XAxis
            dataKey="maand"
            tick={{ fill: "rgba(15,23,42,0.6)", fontSize: 11 }}
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
            wrapperStyle={{ fontSize: "11px", color: "rgba(15,23,42,0.8)" }}
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
            <button
              type="button"
              key={j}
              onClick={() => setActiefJaar(j)}
              className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl p-3 text-left cursor-pointer"
            >
              <p className="text-slate-400 text-xs">{j}</p>
              <p className="font-bold text-lg tabular-nums">
                €{(t.omzet / 1000).toFixed(1)}k
              </p>
              <p className="text-[11px] text-slate-400">
                {t.txs.toLocaleString("nl-NL")} tx
              </p>
            </button>
          );
        })}
      </div>

      <DetailSheet
        open={actiefJaar !== null}
        onClose={() => setActiefJaar(null)}
        titel={actiefJaar !== null ? `Jaar ${actiefJaar}` : ""}
        subtitel="Maand-breakdown · vergelijking met voorgaand jaar"
        hex={hex}
      >
        {actiefJaar !== null && (() => {
          const totaal = jaarTotaal.get(actiefJaar)!;
          const vorigJrTotaal = jaarTotaal.get(actiefJaar - 1);
          const groei = vorigJrTotaal ? ((totaal.omzet - vorigJrTotaal.omzet) / vorigJrTotaal.omzet) * 100 : null;
          const maxOmzet = Math.max(...data.filter((d) => d.jaar === actiefJaar).map((d) => d.omzet), 1);
          return (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
                <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                  Jaar-totaal
                </p>
                <p
                  className="font-display text-[32px] font-semibold tabular-nums leading-none"
                  style={{ color: hex, letterSpacing: "-0.018em" }}
                >
                  €{totaal.omzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                </p>
                <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  {totaal.txs.toLocaleString("nl-NL")} transacties
                  {groei !== null && (
                    <>
                      {" · "}
                      <span style={{ color: groei > 0 ? "var(--sf-success)" : groei < 0 ? "var(--sf-danger)" : "var(--muted)" }}>
                        {groei > 0 ? "+" : ""}{groei.toFixed(1)}% t.o.v. {actiefJaar - 1}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                {MAAND_LABELS.map((m, i) => {
                  const cel = data.find((d) => d.jaar === actiefJaar && d.maand === i + 1);
                  const vorig = data.find((d) => d.jaar === actiefJaar - 1 && d.maand === i + 1);
                  const pct = cel ? (cel.omzet / maxOmzet) * 100 : 0;
                  const maandGroei = cel && vorig && vorig.omzet > 0 ? ((cel.omzet - vorig.omzet) / vorig.omzet) * 100 : null;
                  return (
                    <div key={m} className="flex items-center gap-3">
                      <div className="w-10 shrink-0">
                        <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>{m}</p>
                      </div>
                      <div className="flex-1 h-7 rounded-md overflow-hidden relative" style={{ background: "var(--sf-hairline)" }}>
                        {cel && (
                          <div
                            className="h-full"
                            style={{ width: `${pct}%`, background: `${hex}80` }}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-end pr-2">
                          <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text)" }}>
                            {cel ? `€${(cel.omzet / 1000).toFixed(1)}k` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="w-14 shrink-0 text-right">
                        {maandGroei !== null ? (
                          <span
                            className="font-mono text-[10px] tabular-nums"
                            style={{
                              color: maandGroei > 0 ? "var(--sf-success)" : maandGroei < 0 ? "var(--sf-danger)" : "var(--muted)",
                            }}
                          >
                            {maandGroei > 0 ? "+" : ""}{maandGroei.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Maand-balkjes tonen omzet, percentages rechts vergelijken met dezelfde
                maand vorig jaar. Onvolledige maanden in lopende jaar zijn nog niet afgerond.
              </p>
            </div>
          );
        })()}
      </DetailSheet>
    </div>
  );
}
