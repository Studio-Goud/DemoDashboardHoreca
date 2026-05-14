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
  startSaldo: number;
  startDatum: string;
  saldoOpgeslagen: string | null;
  events: CashflowEvent[];
  dagen: Array<{ datum: string; saldo: number; mutatie: number }>;
  gevarenDagen: string[];
  eindSaldo: number;
  laagsteSaldo: number;
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

  // Saldo-edit state
  const [editSaldo, setEditSaldo] = useState("");
  const [saldoBezig, setSaldoBezig] = useState(false);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await fetch(`/api/cashflow/${bedrijf}?dagen=${dagen}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      setData(j);
      setEditSaldo(j.startSaldo > 0 ? String(j.startSaldo) : "");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setLaden(false);
    }
  }, [bedrijf, dagen]);

  useEffect(() => { laad(); }, [laad]);

  async function saldoOpslaan() {
    const num = Number(editSaldo.replace(",", "."));
    if (!Number.isFinite(num)) {
      setFout("Geef een getal");
      return;
    }
    setSaldoBezig(true);
    try {
      await fetch(`/api/bedrijfsinstellingen/${bedrijf}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ huidigSaldo: num }),
      });
      await laad();
    } finally {
      setSaldoBezig(false);
    }
  }

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

  const geenSaldo = data.startSaldo === 0 && !data.saldoOpgeslagen;
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

      {/* Saldo-input */}
      <div className="rounded-lg p-3 mb-3" style={{ background: geenSaldo ? "#FFF9E6" : "var(--bg)", border: geenSaldo ? "1px solid #F0B731" : "1px solid var(--hairline)" }}>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: "var(--muted)" }}>
              Huidig bank-saldo
            </p>
            {data.saldoOpgeslagen ? (
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                Laatst bijgewerkt {new Date(data.saldoOpgeslagen).toLocaleDateString("nl-NL")}
              </p>
            ) : (
              <p className="text-[10px]" style={{ color: "#B07A0F" }}>
                ⚠️ Nog niet ingevuld — projectie start vanaf €0
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--muted)" }}>€</span>
            <input
              type="number"
              step="0.01"
              value={editSaldo}
              onChange={(e) => setEditSaldo(e.target.value)}
              placeholder="0"
              className="text-sm border border-slate-200 rounded px-2 py-1 w-28 tabular-nums text-right"
            />
            <button
              onClick={saldoOpslaan}
              disabled={saldoBezig || Number(editSaldo) === data.startSaldo}
              className="text-xs font-medium px-3 py-1.5 rounded text-white disabled:opacity-50"
              style={{ background: hex }}
            >
              Update
            </button>
          </div>
        </div>
      </div>

      {/* KPI's */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg p-2.5" style={{ background: "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Start</p>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {fmt(data.startSaldo)}
          </p>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: data.laagsteSaldo < 0 ? "#FFEEED" : "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Laagste</p>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: data.laagsteSaldo < 0 ? "#E5484D" : "var(--text)" }}>
            {fmt(data.laagsteSaldo)}
          </p>
          <p className="text-[9px]" style={{ color: "var(--muted)" }}>op {data.laagsteDatum.slice(5)}</p>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Eind {dagen}d</p>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: data.eindSaldo < data.startSaldo ? "#E07A1F" : "#30B26F" }}>
            {fmt(data.eindSaldo)}
          </p>
        </div>
      </div>

      {/* Waarschuwing */}
      {heeftGevaar && (
        <div className="rounded-lg p-2.5 mb-3 text-[12px]" style={{ background: "#FFEEED", border: "1px solid #FCA5A5", color: "#B91C1C" }}>
          ⚠️ Saldo zakt op {data.gevarenDagen.length} {data.gevarenDagen.length === 1 ? "dag" : "dagen"} onder de drempel.
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
              formatter={(v: number) => [fmtPrecies(v), "Saldo"]}
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
        Projectie op basis van: huidig saldo + verwachte omzet (model op 3 mnd-gemiddelde) + geplande loon
        (rooster × all-in) + vaste lasten (3 mnd-gemiddelde) + kwartaal-BTW-deadlines. Update het saldo regelmatig
        voor de meest accurate projectie.
      </p>
    </div>
  );
}
