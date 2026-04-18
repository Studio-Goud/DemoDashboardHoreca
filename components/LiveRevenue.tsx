"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  Tooltip,
  XAxis,
} from "recharts";

interface UurRij {
  uur: number;
  omzet: number;
  txs: number;
}

interface Tx {
  id: string;
  amount: number;
  timestamp: string;
  payment_type: string;
}

interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
  gemBonVandaag: number;
  uurVerdeling: UurRij[];
  betaalmethoden: Record<string, { omzet: number; aantal: number }>;
  laatsteSale: Tx | null;
  timestamp: string;
}

interface Props {
  bedrijf: "bb" | "sl";
  kleur: string;
  hex: string;
  verwachtVandaag: number;       // totaal verwacht voor vandaag
  weekdagCurve: number[];        // 24 bedragen — gem. omzet per uur voor deze weekdag
}

function labelBetaalmethode(naam: string): string {
  const n = naam.toLowerCase().replace(/[_-]/g, " ").trim();
  if (n === "pos" || n === "card" || n === "kaart" || n.includes("reader")) return "Kaart";
  if (n === "cash" || n === "contant") return "Cash";
  if (n === "mobile" || n === "wallet") return "Mobiel";
  if (n === "boleto") return "Boleto";
  return naam
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function tijdGeleden(isoString: string): string {
  const nu = new Date();
  const dan = new Date(isoString);
  const seconden = Math.floor((nu.getTime() - dan.getTime()) / 1000);
  if (seconden < 60) return `${seconden}s geleden`;
  const minuten = Math.floor(seconden / 60);
  if (minuten < 60) return `${minuten}m geleden`;
  const uren = Math.floor(minuten / 60);
  return `${uren}u ${minuten % 60}m geleden`;
}

function verwachtTotNu(curve: number[]): number {
  if (curve.length !== 24) return 0;
  const nu = new Date();
  const uur = nu.getHours();
  const minuutFractie = nu.getMinutes() / 60;
  let som = 0;
  for (let i = 0; i < uur; i++) som += curve[i] ?? 0;
  som += (curve[uur] ?? 0) * minuutFractie;
  return Math.round(som * 100) / 100;
}

export default function LiveRevenue({
  bedrijf,
  kleur,
  hex,
  verwachtVandaag,
  weekdagCurve,
}: Props) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [laatstGeupdate, setLaatstGeupdate] = useState<Date | null>(null);
  const [nu, setNu] = useState(new Date());

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/sumup/${bedrijf}`, { cache: "no-store" });
      const json = await res.json();
      setData((prev) => {
        if (prev && prev.omzetVandaag !== json.omzetVandaag) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1200);
        }
        return json;
      });
      setLaatstGeupdate(new Date());
    } catch (e) {
      console.error("Live fetch mislukt:", e);
    } finally {
      setLoading(false);
    }
  }, [bedrijf]);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 20_000);
    const klok = setInterval(() => setNu(new Date()), 60_000);
    const onRefresh = () => fetchLive();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchLive();
    };
    window.addEventListener("dashboard:refresh", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      clearInterval(klok);
      window.removeEventListener("dashboard:refresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchLive]);

  const verwachtNu = useMemo(
    () => verwachtTotNu(weekdagCurve),
    // Herbereken elk minuut via nu-dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekdagCurve, nu]
  );

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-slate-100 rounded w-1/2 mb-2" />
        <div className="h-4 bg-slate-50 rounded w-1/3" />
      </div>
    );
  }

  if (!data) return null;

  const opSchema =
    verwachtNu > 0
      ? Math.round((data.omzetVandaag / verwachtNu) * 100)
      : 0;
  const opSchemaPos = opSchema >= 100;

  const betaalLijst = Object.entries(data.betaalmethoden ?? {}).sort(
    (a, b) => b[1].omzet - a[1].omzet
  );

  const resterend =
    Math.max(0, verwachtVandaag - data.omzetVandaag);

  return (
    <div
      className="card relative overflow-hidden border"
      style={{ borderColor: `${hex}30` }}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-ping absolute" />
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-xs text-slate-400 ml-3">live</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Hoofdcijfer */}
        <div>
          <p className="text-slate-500 text-sm mb-1">Omzet vandaag</p>
          <div
            className={`stat-value transition-all duration-500 tabular-nums ${
              pulse ? "scale-110" : "scale-100"
            }`}
            style={{ color: hex }}
          >
            €
            {data.omzetVandaag.toLocaleString("nl-NL", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {data.aantalTransactiesVandaag} tx · gem. €
            {data.gemBonVandaag.toFixed(2)}
          </p>

          {verwachtVandaag > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Voortgang vs verwacht nu</span>
                <span
                  className={
                    opSchemaPos ? "text-emerald-600" : "text-orange-600"
                  }
                >
                  {opSchema}% {opSchemaPos ? "✓" : ""}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(
                      (data.omzetVandaag / Math.max(verwachtVandaag, 1)) * 100,
                      150
                    )}%`,
                    backgroundColor: opSchemaPos ? "#22c55e" : hex,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-slate-900/70"
                  style={{
                    left: `${Math.min(
                      (verwachtNu / Math.max(verwachtVandaag, 1)) * 100,
                      100
                    )}%`,
                  }}
                  title="Verwachte voortgang nu"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums">
                <span>€{verwachtNu.toFixed(0)} verwacht nu</span>
                <span>€{verwachtVandaag.toFixed(0)} doel</span>
              </div>
              {resterend > 0 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Nog €{resterend.toFixed(0)} te gaan tot verwacht dagtotaal
                </p>
              )}
            </div>
          )}
        </div>

        {/* Uur verdeling */}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">
            Omzet per uur vandaag
          </p>
          {data.uurVerdeling.some((u) => u.omzet > 0) ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={data.uurVerdeling}>
                <defs>
                  <linearGradient
                    id={`live-grad-${kleur}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={hex} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={hex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="uur"
                  tick={{ fill: "rgba(15,23,42,0.5)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                  tickFormatter={(v) => `${String(v).padStart(2, "0")}`}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid rgba(15,23,42,0.12)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(v: number, _n, item) => [
                    `€${v.toFixed(2)} · ${item.payload.txs} tx`,
                    `${String(item.payload.uur).padStart(2, "0")}:00`,
                  ]}
                  labelFormatter={() => ""}
                />
                <Area
                  type="monotone"
                  dataKey="omzet"
                  stroke={hex}
                  strokeWidth={1.5}
                  fill={`url(#live-grad-${kleur})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-xs italic mt-3">
              Nog geen transacties vandaag.
            </p>
          )}
        </div>

        {/* Betaalmethoden + laatste verkoop */}
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">
            Betaalmethoden vandaag
          </p>
          {betaalLijst.length > 0 ? (
            <div className="space-y-1.5">
              {betaalLijst.map(([naam, b]) => {
                const pct =
                  data.omzetVandaag > 0
                    ? (b.omzet / data.omzetVandaag) * 100
                    : 0;
                return (
                  <div key={naam} className="transition-colors">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-slate-700 font-medium">
                        {labelBetaalmethode(naam)}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        €{b.omzet.toFixed(0)} · {b.aantal}×
                      </span>
                    </div>
                    <div className="h-1 bg-slate-50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: hex,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-xs italic">Nog geen verkopen.</p>
          )}

          {data.laatsteSale && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-1">
                Laatste verkoop
              </p>
              <div className="flex items-center justify-between">
                <span className="font-semibold tabular-nums">
                  €{data.laatsteSale.amount.toFixed(2)}
                </span>
                <span className="text-slate-400 text-xs">
                  {tijdGeleden(data.laatsteSale.timestamp)}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                {labelBetaalmethode(data.laatsteSale.payment_type)}
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="text-slate-300 text-[10px] mt-4">
        Ververst elke 20s · laatste update:{" "}
        {laatstGeupdate
          ? laatstGeupdate.toLocaleTimeString("nl-NL")
          : "—"}
      </p>
    </div>
  );
}
