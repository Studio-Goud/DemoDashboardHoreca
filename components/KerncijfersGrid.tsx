"use client";

import type { KernCijfers } from "@/lib/analytics";

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
  if (waarde === 0) return <span className="text-slate-400 text-xs">±0%</span>;
  const pos = waarde > 0;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        pos ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {pos ? "▲" : "▼"} {pos ? "+" : ""}
      {waarde}%
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
        <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-0.5">
          {label}
        </p>
        <p className="text-lg font-bold tabular-nums text-slate-900">
          {fmtEur(huidig.omzet)}
        </p>
        <p className="text-[11px] text-slate-400 truncate">
          {huidig.txs.toLocaleString("nl-NL")} tx · vs {fmtEurKort(vergelijking.omzet)} ({vergelijking.label})
        </p>
      </div>
      <div className="text-right">
        <Delta waarde={groei} />
      </div>
    </div>
  );
}

export default function KerncijfersGrid({ kerncijfers: k, hex }: Props) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold text-slate-700">Kerncijfers</h3>
        <span className="text-[11px] text-slate-400">
          bedragen incl. BTW · live
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 divide-y divide-slate-100 sm:divide-y-0">
        <PeriodeRow
          label="Vandaag"
          huidig={{ ...k.vandaag }}
          vergelijking={{
            omzet: k.zelfdeDagVorigeWeek.omzet,
            txs: k.zelfdeDagVorigeWeek.txs,
            label: "zelfde dag v. week",
          }}
          groei={k.groei.tovZelfdeDagVorigeWeek}
        />
        <PeriodeRow
          label="Deze week (t/m nu)"
          huidig={{ ...k.dezeWeek }}
          vergelijking={{ ...k.vorigeWeek, label: "vorige week" }}
          groei={k.groei.tovVorigeWeek}
        />
        <PeriodeRow
          label={k.dezeMaand.label}
          huidig={{ ...k.dezeMaand }}
          vergelijking={{
            omzet: k.vorigeMaandTotNu.omzet,
            txs: k.vorigeMaandTotNu.txs,
            label: "vorige maand t/m nu",
          }}
          groei={k.groei.tovVorigeMaand}
        />
        <PeriodeRow
          label={`${new Date().getFullYear()} YTD`}
          huidig={{ ...k.ditJaar }}
          vergelijking={{
            omzet: k.vorigJaarTotNu.omzet,
            txs: k.vorigJaarTotNu.txs,
            label: `${new Date().getFullYear() - 1} YTD`,
          }}
          groei={k.groei.tovVorigJaar}
        />
        <PeriodeRow
          label="Gisteren"
          huidig={{ ...k.gisteren }}
          vergelijking={{
            omzet: k.vandaag.omzet,
            txs: k.vandaag.txs,
            label: "vandaag",
          }}
          groei={-k.groei.tovGisteren}
        />
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-0.5">
              Gemiddelde dag
            </p>
            <p className="text-lg font-bold tabular-nums text-slate-900">
              {fmtEur(k.gemOmzetPerDag)}
            </p>
            <p className="text-[11px] text-slate-400">
              {k.gemTxPerDag} tx/dag
              {k.druksteDag
                ? ` · beste: ${fmtEurKort(k.druksteDag.omzet)}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      {k.laatsteTx && (
        <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
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
