"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";
import DetailSheet from "./sf/DetailSheet";

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
  const { t } = useTaal();
  const [rij, setRij] = useState<BedrijfRij | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<null | "dag" | "week">(null);

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
    const id = setInterval(laden, 2 * 60_000);
    return () => clearInterval(id);
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
          {t("manager.goals")}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Dag-doel */}
        <button
          type="button"
          onClick={() => setSheet("dag")}
          className="flex items-center gap-3 hover:bg-white/[0.02] transition-colors -mx-2 px-2 py-1 rounded-lg text-left"
        >
          <Ring pct={dagPct} hex={hex} label={t("manager.target_today")} />
          <div className="min-w-0">
            <p className="eyebrow">{t("manager.goal_day")}</p>
            <p className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmtEur(rij.vandaag.omzet)}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {t("manager.target")} {fmtEur(dagDoel)}
            </p>
            {dagTeGaan > 0 ? (
              <p className="text-[10px] mt-0.5" style={{ color: hex }}>
                {t("manager.still_to_go").replace("{bedrag}", fmtEur(dagTeGaan))}
              </p>
            ) : (
              <p className="text-[10px] mt-0.5" style={{ color: "#30B26F" }}>
                {t("manager.goal_done")}
              </p>
            )}
          </div>
        </button>

        {/* Week-doel */}
        <button
          type="button"
          onClick={() => setSheet("week")}
          className="flex items-center gap-3 hover:bg-white/[0.02] transition-colors -mx-2 px-2 py-1 rounded-lg text-left"
        >
          <Ring pct={weekPct} hex={hex} label={t("manager.this_week_label")} />
          <div className="min-w-0">
            <p className="eyebrow">{t("manager.goal_week")}</p>
            <p className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmtEur(rij.dezeWeek.omzet)}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {t("manager.target")} {fmtEur(weekDoel)} <span style={{ opacity: 0.6 }}>(+5%)</span>
            </p>
            {weekTeGaan > 0 ? (
              <p className="text-[10px] mt-0.5" style={{ color: hex }}>
                {t("manager.still_to_go").replace("{bedrag}", fmtEur(weekTeGaan))}
              </p>
            ) : (
              <p className="text-[10px] mt-0.5" style={{ color: "#30B26F" }}>
                {t("manager.goal_done")}
              </p>
            )}
          </div>
        </button>
      </div>

      <DetailSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        titel={sheet === "dag" ? "Dagdoel" : "Weekdoel"}
        subtitel={sheet === "dag" ? "Verwachte omzet op basis van historische curve" : "Vorige week + 5% groei-ambitie"}
        hex={hex}
      >
        {sheet === "dag" ? (
          <DoelDetail
            hex={hex}
            label="Vandaag"
            huidig={rij.vandaag.omzet}
            doel={dagDoel}
            pct={dagPct}
            teGaan={dagTeGaan}
            extra={`Verwacht is gebaseerd op gem. omzet van dezelfde weekdag in de laatste 8 weken (exclusief feestdagen).`}
            txs={rij.vandaag.txs}
          />
        ) : sheet === "week" ? (
          <DoelDetail
            hex={hex}
            label="Deze week"
            huidig={rij.dezeWeek.omzet}
            doel={weekDoel}
            pct={weekPct}
            teGaan={weekTeGaan}
            extra={`Doel = vorige week (${fmtEur(rij.vorigeWeek.omzet)}) × 1.05 — ambitie om elke week 5% beter te doen.`}
            txs={rij.dezeWeek.txs}
            vergelijking={{ label: "vorige week", waarde: rij.vorigeWeek.omzet, groei: rij.groei.tovVorigeWeek }}
          />
        ) : null}
      </DetailSheet>
    </div>
  );
}

function DoelDetail({
  hex,
  label,
  huidig,
  doel,
  pct,
  teGaan,
  extra,
  txs,
  vergelijking,
}: {
  hex: string;
  label: string;
  huidig: number;
  doel: number;
  pct: number;
  teGaan: number;
  extra: string;
  txs: number;
  vergelijking?: { label: string; waarde: number; groei: number };
}) {
  const haald = pct >= 1;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
          {label}
        </p>
        <p
          className="font-display text-[36px] font-semibold tabular-nums leading-none"
          style={{ color: haald ? "#30B26F" : hex, letterSpacing: "-0.018em" }}
        >
          {Math.round(pct * 100)}%
        </p>
        <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          {fmtEur(huidig)} / {fmtEur(doel)} · {txs.toLocaleString("nl-NL")} transacties
        </p>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--sf-hairline)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, pct * 100)}%`, background: haald ? "#30B26F" : hex }}
          />
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
        <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
          Status
        </p>
        {haald ? (
          <p className="text-[13px]" style={{ color: "#30B26F" }}>
            ✓ Doel behaald — overschreden met {fmtEur(huidig - doel)}.
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--text)" }}>
            Nog <strong style={{ color: hex }}>{fmtEur(teGaan)}</strong> tot het doel.
          </p>
        )}
      </div>

      {vergelijking && (
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            Vergelijking
          </p>
          <p className="text-[13px]" style={{ color: "var(--text)" }}>
            T.o.v. <strong>{vergelijking.label}</strong> ({fmtEur(vergelijking.waarde)}):{" "}
            <span style={{ color: vergelijking.groei > 0 ? "var(--sf-success)" : vergelijking.groei < 0 ? "var(--sf-danger)" : "var(--muted)" }}>
              {vergelijking.groei > 0 ? "+" : ""}{vergelijking.groei}%
            </span>
          </p>
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        {extra}
      </p>
    </div>
  );
}
