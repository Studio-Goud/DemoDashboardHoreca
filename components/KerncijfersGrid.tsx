"use client";

import type { KernCijfers } from "@/lib/analytics";
import Icon from "./Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";

interface Props {
  kerncijfers: KernCijfers;
  hex: string;
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtEurKort(n: number): string {
  if (Math.abs(n) >= 10000)
    return `€${(n / 1000).toLocaleString("nl-NL", {
      maximumFractionDigits: 1,
    })}k`;
  return `€${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
}

function Delta({ waarde }: { waarde: number }) {
  if (waarde === 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums"
        style={{ color: "var(--muted)" }}
      >
        <Icon name="minus" size={11} strokeWidth={2.5} />
        0%
      </span>
    );
  }
  const pos = waarde > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums"
      style={{ color: pos ? "#30B26F" : "#E5484D" }}
    >
      <Icon name={pos ? "arrow-up" : "arrow-down"} size={11} strokeWidth={2.5} />
      {pos ? "+" : ""}{waarde}%
    </span>
  );
}

interface PeriodeRowProps {
  label: string;
  huidig: { omzet: number; txs: number; label: string };
  vergelijking: { omzet: number; txs: number; label: string };
  groei: number;
}

function PeriodeRow({ label, huidig, vergelijking, groei }: PeriodeRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
      <div className="min-w-0">
        <p className="eyebrow mb-1">{label}</p>
        <p
          className="text-[19px] font-semibold tabular-nums"
          style={{ color: "var(--text)", letterSpacing: "-0.014em" }}
        >
          {fmtEur(huidig.omzet)}
        </p>
        <p className="text-[12px] truncate" style={{ color: "var(--muted)" }}>
          {huidig.txs.toLocaleString("nl-NL")} tx · vs {fmtEurKort(vergelijking.omzet)} ({vergelijking.label})
        </p>
      </div>
      <div className="text-right">
        <Delta waarde={groei} />
      </div>
    </div>
  );
}

export default function KerncijfersGrid({ kerncijfers: k }: Props) {
  const { t } = useTaal();
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
          {t("kerncijfers.title")}
        </h3>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("kerncijfers.incl_btw")}
        </span>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 sm:divide-y-0"
        style={{ borderColor: "var(--hairline-2)" }}
      >
        <PeriodeRow
          label={t("kerncijfers.today_so_far")}
          huidig={{ ...k.vandaag }}
          vergelijking={{
            omzet: k.gisteren.omzet,
            txs: k.gisteren.txs,
            label: "gisteren zelfde tijd",
          }}
          groei={k.groei.tovGisteren}
        />
        <PeriodeRow
          label={t("kerncijfers.same_weekday_last_week")}
          huidig={{ ...k.vandaag }}
          vergelijking={{
            omzet: k.zelfdeDagVorigeWeek.omzet,
            txs: k.zelfdeDagVorigeWeek.txs,
            label: k.zelfdeDagVorigeWeek.label + " zelfde tijd",
          }}
          groei={k.groei.tovZelfdeDagVorigeWeek}
        />
        <PeriodeRow
          label={t("kerncijfers.this_week_so_far")}
          huidig={{ ...k.dezeWeek }}
          vergelijking={{ ...k.vorigeWeek, label: "vorige week zelfde moment" }}
          groei={k.groei.tovVorigeWeek}
        />
        <PeriodeRow
          label={k.dezeMaand.label + " t/m nu"}
          huidig={{ ...k.dezeMaand }}
          vergelijking={{
            omzet: k.vorigeMaandTotNu.omzet,
            txs: k.vorigeMaandTotNu.txs,
            label: "vorige maand zelfde moment",
          }}
          groei={k.groei.tovVorigeMaand}
        />
        <PeriodeRow
          label={`${new Date().getFullYear()} YTD t/m nu`}
          huidig={{ ...k.ditJaar }}
          vergelijking={{
            omzet: k.vorigJaarTotNu.omzet,
            txs: k.vorigJaarTotNu.txs,
            label: `${new Date().getFullYear() - 1} zelfde moment`,
          }}
          groei={k.groei.tovVorigJaar}
        />
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
          <div>
            <p className="eyebrow mb-1">{t("kerncijfers.average_day")}</p>
            <p
              className="text-[19px] font-semibold tabular-nums"
              style={{ color: "var(--text)", letterSpacing: "-0.014em" }}
            >
              {fmtEur(k.gemOmzetPerDag)}
            </p>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {k.gemTxPerDag} tx/dag
              {k.druksteDag ? ` · beste: ${fmtEurKort(k.druksteDag.omzet)}` : ""}
            </p>
          </div>
        </div>
      </div>

      {k.laatsteTx && (
        <p className="text-[11px] mt-3 pt-3 hairline" style={{ color: "var(--muted)" }}>
          Laatste transactie: {fmtEur(k.laatsteTx.amount)} ·{" "}
          {k.tijdSindsLaatsteTxMin !== null
            ? k.tijdSindsLaatsteTxMin < 1
              ? "zojuist"
              : k.tijdSindsLaatsteTxMin < 60
              ? `${k.tijdSindsLaatsteTxMin} min geleden`
              : `${Math.floor(k.tijdSindsLaatsteTxMin / 60)}u ${k.tijdSindsLaatsteTxMin % 60}m geleden`
            : ""}
        </p>
      )}
    </div>
  );
}
