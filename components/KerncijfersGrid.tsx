"use client";

import type { KernCijfers, PeriodeCijfer } from "@/lib/analytics";

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
  const pos = waarde >= 0;
  return (
    <span
      className={`text-xs font-medium ${
        pos ? "text-green-400" : "text-red-400"
      }`}
    >
      {pos ? "▲" : "▼"} {pos ? "+" : ""}
      {waarde}%
    </span>
  );
}

function Tegel({
  titel,
  waarde,
  subregel,
  delta,
  accent,
  hex,
}: {
  titel: string;
  waarde: string;
  subregel?: string;
  delta?: number;
  accent?: boolean;
  hex?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 border"
      style={{
        backgroundColor: accent && hex ? `${hex}15` : "rgba(255,255,255,0.04)",
        borderColor: accent && hex ? `${hex}55` : "rgba(255,255,255,0.08)",
      }}
    >
      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
        {titel}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent && hex ? hex : undefined }}
      >
        {waarde}
      </p>
      <div className="flex items-center justify-between mt-1 min-h-[16px]">
        <span className="text-[11px] text-white/40">{subregel ?? ""}</span>
        {typeof delta === "number" && <Delta waarde={delta} />}
      </div>
    </div>
  );
}

export default function KerncijfersGrid({ kerncijfers, hex }: Props) {
  const k = kerncijfers;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-white/80">Kerncijfers</h3>
        <span className="text-[11px] text-white/30">
          Alle bedragen incl. BTW · live
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Tegel
          titel="Vandaag"
          waarde={fmtEur(k.vandaag.omzet)}
          subregel={`${k.vandaag.txs} tx · gem. ${fmtEur(k.vandaag.gemBon)}`}
          delta={k.groei.tovZelfdeDagVorigeWeek}
          accent
          hex={hex}
        />
        <Tegel
          titel="Verwacht vandaag"
          waarde={fmtEur(k.verwachtVandaag)}
          subregel={
            k.resterendVandaag > 0
              ? `Nog ${fmtEur(k.resterendVandaag)} te gaan`
              : k.verwachtVandaag > 0
              ? "Doel bereikt ✓"
              : "Onvoldoende historie"
          }
        />
        <Tegel
          titel="Gisteren"
          waarde={fmtEur(k.gisteren.omzet)}
          subregel={`${k.gisteren.txs} tx · gem. ${fmtEur(k.gisteren.gemBon)}`}
          delta={k.groei.tovGisteren}
        />
        <Tegel
          titel={k.zelfdeDagVorigeWeek.label}
          waarde={fmtEur(k.zelfdeDagVorigeWeek.omzet)}
          subregel={`${k.zelfdeDagVorigeWeek.txs} tx`}
        />

        <Tegel
          titel="Deze week (t/m nu)"
          waarde={fmtEur(k.dezeWeek.omzet)}
          subregel={`${k.dezeWeek.txs} tx · gem. ${fmtEur(k.dezeWeek.gemBon)}`}
          delta={k.groei.tovVorigeWeek}
        />
        <Tegel
          titel="Vorige week"
          waarde={fmtEur(k.vorigeWeek.omzet)}
          subregel={`${k.vorigeWeek.txs} tx · gem. ${fmtEur(
            k.vorigeWeek.gemBon
          )}`}
        />
        <Tegel
          titel={k.dezeMaand.label}
          waarde={fmtEur(k.dezeMaand.omzet)}
          subregel={`${k.dezeMaand.txs} tx`}
          delta={k.groei.tovVorigeMaand}
        />
        <Tegel
          titel={k.vorigeMaandTotNu.label}
          waarde={fmtEur(k.vorigeMaandTotNu.omzet)}
          subregel={`${k.vorigeMaandTotNu.txs} tx`}
        />

        <Tegel
          titel={k.ditJaar.label}
          waarde={fmtEurKort(k.ditJaar.omzet)}
          subregel={`${k.ditJaar.txs.toLocaleString("nl-NL")} tx`}
          delta={k.groei.tovVorigJaar}
        />
        <Tegel
          titel={k.vorigJaarTotNu.label}
          waarde={fmtEurKort(k.vorigJaarTotNu.omzet)}
          subregel={`${k.vorigJaarTotNu.txs.toLocaleString("nl-NL")} tx`}
        />
        <Tegel
          titel="Gem. omzet / dag"
          waarde={fmtEur(k.gemOmzetPerDag)}
          subregel={`Gem. ${k.gemTxPerDag} tx/dag`}
        />
        <Tegel
          titel="Druksste dag ooit"
          waarde={
            k.druksteDag ? fmtEur(k.druksteDag.omzet) : "—"
          }
          subregel={k.druksteDag?.datum ?? ""}
        />
      </div>

      {k.laatsteTx && (
        <p className="text-[11px] text-white/30 mt-3">
          Laatste transactie: {fmtEur(k.laatsteTx.amount)} ·{" "}
          {k.tijdSindsLaatsteTxMin !== null
            ? k.tijdSindsLaatsteTxMin < 1
              ? "zojuist"
              : k.tijdSindsLaatsteTxMin < 60
              ? `${k.tijdSindsLaatsteTxMin} min geleden`
              : `${Math.floor(k.tijdSindsLaatsteTxMin / 60)}u ${
                  k.tijdSindsLaatsteTxMin % 60
                }m geleden`
            : ""}
        </p>
      )}
    </div>
  );
}
