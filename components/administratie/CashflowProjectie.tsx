"use client";

import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from "recharts";

type Slug = "bb" | "sl" | "kl";

interface CashflowEvent {
  datum: string;
  type: "omzet" | "loon" | "vaste_lasten" | "btw" | "factuur" | "overig";
  omschrijving: string;
  mutatie: number;
  saldoNa: number;
}

interface CashflowData {
  bedrijf: Slug;
  startDatum: string;
  events: CashflowEvent[];
  dagen: Array<{ datum: string; saldo: number; mutatie: number }>;
  gevarenDagen: string[];
  eindDelta: number;
  laagsteDelta: number;
  laagsteDatum: string;
}

interface Props {
  bedrijf: Slug;
  hex: string;
}

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPrecies(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_LABELS: Record<CashflowEvent["type"], string> = {
  omzet: "💰 Omzet",
  loon: "👤 Loon",
  vaste_lasten: "📋 Vaste lasten",
  btw: "🧾 BTW",
  factuur: "🧾 Factuur",
  overig: "•",
};

export default function CashflowProjectie({ bedrijf, hex }: Props) {
  const [dagen, setDagen] = useState<30 | 60 | 90>(60);
  const [data, setData] = useState<CashflowData | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await fetch(`/api/cashflow/${bedrijf}?dagen=${dagen}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setLaden(false);
    }
  }, [bedrijf, dagen]);

  useEffect(() => { laad(); }, [laad]);

  if (laden && !data) {
    return (
      <div className="card">
        <div className="h-48 bg-slate-50 rounded animate-pulse" />
      </div>
    );
  }

  if (fout) {
    return (
      <div className="card">
        <p className="eyebrow mb-1">Cashflow-projectie</p>
        <p className="text-sm" style={{ color: "#E5484D" }}>Fout: {fout}</p>
      </div>
    );
  }

  if (!data) return null;

  const heeftGevaar = data.gevarenDagen.length > 0;
  const grafiekData = data.dagen.map((d) => ({
    datum: d.datum.slice(5),
    saldo: d.saldo,
    gevaar: data.gevarenDagen.includes(d.datum) ? d.saldo : null,
  }));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">Cashflow</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            💧 Projectie {dagen} dagen
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDagen(d)}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{
                background: dagen === d ? hex : "var(--bg-elev)",
                color: dagen === d ? "#fff" : "var(--text-2)",
                border: dagen === d ? "none" : "1px solid var(--hairline)",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI's — cumulatieve delta vanaf nu (geen absoluut saldo) */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg p-2.5" style={{ background: data.laagsteDelta < 0 ? "#FFEEED" : "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Laagste netto</p>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: data.laagsteDelta < 0 ? "#E5484D" : "var(--text)" }}>
            {data.laagsteDelta >= 0 ? "+" : ""}{fmt(data.laagsteDelta)}
          </p>
          <p className="text-[9px]" style={{ color: "var(--muted)" }}>op {data.laagsteDatum.slice(5)}</p>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Eind {dagen}d</p>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: data.eindDelta < 0 ? "#E07A1F" : "#30B26F" }}>
            {data.eindDelta >= 0 ? "+" : ""}{fmt(data.eindDelta)}
          </p>
        </div>
      </div>

      {/* Waarschuwing */}
      {heeftGevaar && (
        <div className="rounded-lg p-2.5 mb-3 text-[12px]" style={{ background: "#FFEEED", border: "1px solid #FCA5A5", color: "#B91C1C" }}>
          ⚠️ Cumulatieve cashflow gaat op {data.gevarenDagen.length} {data.gevarenDagen.length === 1 ? "dag" : "dagen"} onder nul.
          Eerste keer: <strong>{data.gevarenDagen[0]}</strong>.
        </div>
      )}

      {/* Grafiek */}
      <div className="h-48 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={grafiekData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hex} stopOpacity={0.3} />
                <stop offset="100%" stopColor={hex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="datum" tick={{ fontSize: 9 }} interval={Math.floor(dagen / 8)} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v)} stroke="#94a3b8" width={50} />
            <Tooltip
              formatter={(v: number) => [fmtPrecies(v), "Cumulatief netto"]}
              labelFormatter={(l) => `Datum: ${l}`}
              contentStyle={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#E5484D" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="saldo" stroke={hex} fill="url(#saldoFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top 5 grootste mutaties */}
      <details className="text-[12px]">
        <summary className="cursor-pointer text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          📋 Geplande mutaties ({data.events.length})
        </summary>
        <ul className="mt-2 divide-y divide-slate-100 max-h-60 overflow-y-auto">
          {data.events.slice(0, 50).map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-[11px]">
                  <span style={{ color: "var(--muted)" }}>{e.datum.slice(5)}</span>
                  <span className="ml-2" style={{ color: "var(--text)" }}>{TYPE_LABELS[e.type]}</span>
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--muted)" }}>{e.omschrijving}</p>
              </div>
              <span
                className="text-[12px] font-medium tabular-nums shrink-0"
                style={{ color: e.mutatie >= 0 ? "#30B26F" : "#E07A1F" }}
              >
                {e.mutatie >= 0 ? "+" : ""}{fmt(e.mutatie)}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-[10px] mt-3" style={{ color: "var(--muted)" }}>
        Cumulatief netto-effect vanaf nu: verwachte omzet (3 mnd-gemiddelde × dag-factor) minus geplande loon
        (rooster × all-in), vaste lasten (3 mnd-gemiddelde) en kwartaal-BTW-deadlines. Geen absoluut bank-saldo.
      </p>
    </div>
  );
}
