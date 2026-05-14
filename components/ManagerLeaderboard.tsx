"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";

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
  gegenereerd: string;
}

interface Props {
  /** Slug van eigen vestiging — krijgt extra highlight in de lijst */
  eigen: "bb" | "sl" | "kl";
}

function fmtEur(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n > 0 ? "+" : "") + n.toFixed(0) + "%";
}

export default function ManagerLeaderboard({ eigen }: Props) {
  const { t } = useTaal();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function laden() {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        const json = (await res.json()) as LeaderboardData;
        setData(json);
      } catch {
        // stil
      } finally {
        setLoading(false);
      }
    }
    laden();
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="card">
        <div className="h-5 rounded animate-pulse" style={{ background: "var(--hairline)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("manager.unavailable")}
        </p>
      </div>
    );
  }

  // Ranglijst op deze week
  const gerangschikt = [...data.bedrijven].sort((a, b) => b.dezeWeek.omzet - a.dezeWeek.omzet);
  const maxOmzet = gerangschikt[0]?.dezeWeek.omzet || 1;

  const eigenRij = gerangschikt.findIndex((b) => b.slug === eigen);
  const positie = eigenRij + 1;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="trending-up" size={16} className="opacity-70" />
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
            {t("manager.leaderboard")}
          </h2>
        </div>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("manager.you_are")} {positie === 1 ? t("manager.pos_1") : positie === 2 ? t("manager.pos_2") : t("manager.pos_3")}
        </span>
      </div>

      <div className="space-y-2">
        {gerangschikt.map((b, idx) => {
          const isEigen = b.slug === eigen;
          const breedte = (b.dezeWeek.omzet / maxOmzet) * 100;
          const pos = idx + 1;
          return (
            <div
              key={b.slug}
              className="relative rounded-[10px] p-2.5 transition-all"
              style={{
                background: isEigen ? `${b.hex}10` : "var(--bg)",
                border: `1px solid ${isEigen ? `${b.hex}44` : "var(--hairline)"}`,
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: pos === 1 ? b.hex : "var(--muted)" }}
                  >
                    {pos}
                  </span>
                  <span
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {b.naam}
                  </span>
                  {isEigen && (
                    <span
                      className="text-[10px] px-1.5 py-px rounded-full font-medium"
                      style={{ background: `${b.hex}1F`, color: b.hex }}
                    >
                      {t("manager.your_branch")}
                    </span>
                  )}
                </div>
                <span
                  className="text-[13px] font-semibold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {fmtEur(b.dezeWeek.omzet)}
                </span>
              </div>

              {/* Voortgangsbar */}
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--hairline-2)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${breedte}%`, background: b.hex }}
                />
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {t("manager.last_week")} {fmtEur(b.vorigeWeek.omzet)}
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums"
                  style={{
                    color:
                      b.groei.tovVorigeWeek > 0
                        ? "#30B26F"
                        : b.groei.tovVorigeWeek < 0
                        ? "#E5484D"
                        : "var(--muted)",
                  }}
                >
                  <Icon
                    name={
                      b.groei.tovVorigeWeek > 0
                        ? "arrow-up"
                        : b.groei.tovVorigeWeek < 0
                        ? "arrow-down"
                        : "minus"
                    }
                    size={10}
                    strokeWidth={2.5}
                  />
                  {fmtPct(b.groei.tovVorigeWeek)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
