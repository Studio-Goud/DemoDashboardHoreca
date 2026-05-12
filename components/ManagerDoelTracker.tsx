"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

interface BedrijfRij {
  slug: "bb" | "sl" | "kl";
  naam: string;
  hex: string;
  dezeWeek:   { omzet: number; txs: number };
  vorigeWeek: { omzet: number; txs: number };
  vandaag:    { omzet: number; txs: number; verwacht: number };
  groei: { tovVorigeWeek: number };
}
interface LeaderboardData {
  bedrijven: BedrijfRij[];
}

interface Props {
  eigen: "bb" | "sl" | "kl";
  /** Hex-accent voor eigen vestiging (gemakkelijker dan opzoeken) */
  hex: string;
}

function fmtEur(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
}

function Ring({ pct, hex, label }: { pct: number; hex: string; label: string }) {
  const clamp = Math.max(0, Math.min(1, pct));
  const radius = 26;
  const omtrek = 2 * Math.PI * radius;
  const dash = omtrek * clamp;
  const haald = clamp >= 1;

  return (
    <div className="relative w-[68px] h-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="-rotate-90 w-full h-full">
        <circle
          cx="32" cy="32" r={radius}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth="5"
        />
        <circle
          cx="32" cy="32" r={radius}
          fill="none"
          stroke={haald ? "#30B26F" : hex}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${omtrek - dash}`}
          style={{ transition: "stroke-dasharray 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[14px] font-semibold tabular-nums leading-none"
          style={{ color: haald ? "#30B26F" : "var(--text)" }}
        >
          {Math.round(clamp * 100)}%
        </span>
        <span className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
    </div>
  );
}

export default function ManagerDoelTracker({ eigen, hex }: Props) {
  const [rij, setRij] = useState<BedrijfRij | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function laden() {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const json = (await res.json()) as LeaderboardData;
        const mij = json.bedrijven.find((b) => b.slug === eigen) ?? null;
        setRij(mij);
      } catch {
        // stil
      } finally {
        setLoading(false);
      }
    }
    laden();
    const t = setInterval(laden, 2 * 60_000);
    return () => clearInterval(t);
  }, [eigen]);

  if (loading) {
    return (
      <div className="card">
        <div className="h-5 rounded animate-pulse" style={{ background: "var(--hairline)" }} />
      </div>
    );
  }

  if (!rij) return null;

  // Dagdoel = verwachte dagomzet (uit historische curve)
  const dagDoel = rij.vandaag.verwacht;
  const dagPct = dagDoel > 0 ? rij.vandaag.omzet / dagDoel : 0;

  // Weekdoel = vorige week × 1.05 (5% groei-ambitie)
  const weekDoel = rij.vorigeWeek.omzet * 1.05;
  const weekPct = weekDoel > 0 ? rij.dezeWeek.omzet / weekDoel : 0;

  const dagTeGaan = Math.max(0, dagDoel - rij.vandaag.omzet);
  const weekTeGaan = Math.max(0, weekDoel - rij.dezeWeek.omzet);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="circle-dot" size={16} className="opacity-70" />
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
          Doelen
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Dag-doel */}
        <div className="flex items-center gap-3">
          <Ring pct={dagPct} hex={hex} label="vandaag" />
          <div className="min-w-0">
            <p className="eyebrow">Dag</p>
            <p className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmtEur(rij.vandaag.omzet)}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              doel {fmtEur(dagDoel)}
            </p>
            {dagTeGaan > 0 ? (
              <p className="text-[10px] mt-0.5" style={{ color: hex }}>
                nog {fmtEur(dagTeGaan)} te gaan
              </p>
            ) : (
              <p className="text-[10px] mt-0.5" style={{ color: "#30B26F" }}>
                doel gehaald ✓
              </p>
            )}
          </div>
        </div>

        {/* Week-doel */}
        <div className="flex items-center gap-3">
          <Ring pct={weekPct} hex={hex} label="deze week" />
          <div className="min-w-0">
            <p className="eyebrow">Week</p>
            <p className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmtEur(rij.dezeWeek.omzet)}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              doel {fmtEur(weekDoel)} <span style={{ opacity: 0.6 }}>(+5%)</span>
            </p>
            {weekTeGaan > 0 ? (
              <p className="text-[10px] mt-0.5" style={{ color: hex }}>
                nog {fmtEur(weekTeGaan)} te gaan
              </p>
            ) : (
              <p className="text-[10px] mt-0.5" style={{ color: "#30B26F" }}>
                doel gehaald ✓
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
