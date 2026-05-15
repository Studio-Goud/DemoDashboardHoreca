"use client";

import { useState } from "react";
import type { KernCijfers } from "@/lib/analytics";
import Icon from "./Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";
import DetailSheet from "./sf/DetailSheet";

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
        className="inline-flex items-center gap-0.5 font-mono text-[12px] font-medium tabular-nums"
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
      className="inline-flex items-center gap-0.5 font-mono text-[12px] font-medium tabular-nums"
      style={{ color: pos ? "var(--sf-success)" : "var(--sf-danger)" }}
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
  hex: string;
  onClick: () => void;
}

function PeriodeRow({ label, huidig, vergelijking, groei, onClick }: PeriodeRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 w-full text-left hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg cursor-pointer"
    >
      <div className="min-w-0">
        <p className="eyebrow mb-1">{label}</p>
        <p
          className="font-display text-[19px] font-semibold tabular-nums"
          style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
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
      <Icon name="chevron-right" size={12} className="opacity-40 shrink-0" />
    </button>
  );
}

interface ActieveRij {
  titel: string;
  subtitel: string;
  huidig: { omzet: number; txs: number; gemBon: number; label: string };
  vergelijking: { omzet: number; txs: number; gemBon: number; label: string };
  groei: number;
}

export default function KerncijfersGrid({ kerncijfers: k, hex }: Props) {
  const { t } = useTaal();
  const [actief, setActief] = useState<ActieveRij | null>(null);
  const open = (rij: ActieveRij) => setActief(rij);
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
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
          hex={hex}
          onClick={() =>
            open({
              titel: "Vandaag tot nu",
              subtitel: "Vergeleken met gisteren tot hetzelfde moment",
              huidig: k.vandaag,
              vergelijking: { ...k.gisteren, label: "gisteren zelfde tijd" },
              groei: k.groei.tovGisteren,
            })
          }
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
          hex={hex}
          onClick={() =>
            open({
              titel: "Zelfde weekdag vorige week",
              subtitel: `Patroon-vergelijking — zelfde weekdag, zelfde tijd`,
              huidig: k.vandaag,
              vergelijking: { ...k.zelfdeDagVorigeWeek, label: k.zelfdeDagVorigeWeek.label + " zelfde tijd" },
              groei: k.groei.tovZelfdeDagVorigeWeek,
            })
          }
        />
        <PeriodeRow
          label={t("kerncijfers.this_week_so_far")}
          huidig={{ ...k.dezeWeek }}
          vergelijking={{ ...k.vorigeWeek, label: "vorige week zelfde moment" }}
          groei={k.groei.tovVorigeWeek}
          hex={hex}
          onClick={() =>
            open({
              titel: "Deze week tot nu",
              subtitel: "Week-totaal vs vorige week tot hetzelfde moment",
              huidig: k.dezeWeek,
              vergelijking: { ...k.vorigeWeek, label: "vorige week zelfde moment" },
              groei: k.groei.tovVorigeWeek,
            })
          }
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
          hex={hex}
          onClick={() =>
            open({
              titel: k.dezeMaand.label + " tot nu",
              subtitel: "Maand-totaal vs vorige maand tot dezelfde dag",
              huidig: k.dezeMaand,
              vergelijking: { ...k.vorigeMaandTotNu, label: "vorige maand zelfde moment" },
              groei: k.groei.tovVorigeMaand,
            })
          }
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
          hex={hex}
          onClick={() =>
            open({
              titel: `${new Date().getFullYear()} YTD`,
              subtitel: `Jaar-totaal vs ${new Date().getFullYear() - 1} tot hetzelfde moment`,
              huidig: k.ditJaar,
              vergelijking: { ...k.vorigJaarTotNu, label: `${new Date().getFullYear() - 1} zelfde moment` },
              groei: k.groei.tovVorigJaar,
            })
          }
        />
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
          <div>
            <p className="eyebrow mb-1">{t("kerncijfers.average_day")}</p>
            <p
              className="font-display text-[19px] font-semibold tabular-nums"
              style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
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

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief?.titel ?? ""}
        subtitel={actief?.subtitel}
        hex={hex}
      >
        {actief && <KerncijferDetail rij={actief} hex={hex} />}
      </DetailSheet>
    </div>
  );
}

function KerncijferDetail({ rij, hex }: { rij: ActieveRij; hex: string }) {
  const verschilEur = rij.huidig.omzet - rij.vergelijking.omzet;
  const verschilTxs = rij.huidig.txs - rij.vergelijking.txs;
  const verschilBon = rij.huidig.gemBon - rij.vergelijking.gemBon;
  const groeiKleur =
    rij.groei > 0 ? "var(--sf-success)" : rij.groei < 0 ? "var(--sf-danger)" : "var(--muted)";
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
          Groei
        </p>
        <p
          className="font-display text-[36px] font-semibold tabular-nums leading-none"
          style={{ color: groeiKleur, letterSpacing: "-0.018em" }}
        >
          {rij.groei > 0 ? "+" : ""}{rij.groei}%
        </p>
        <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          {verschilEur > 0 ? "+" : ""}{fmtEur(verschilEur)} t.o.v. de referentieperiode
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ border: `1px solid ${hex}40`, background: `${hex}08` }}>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: hex }}>
            Huidig
          </p>
          <p className="font-display text-[22px] font-semibold tabular-nums leading-tight" style={{ color: "var(--text)" }}>
            {fmtEur(rij.huidig.omzet)}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {rij.huidig.txs.toLocaleString("nl-NL")} tx · {fmtEur(rij.huidig.gemBon)}/bon
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            Referentie
          </p>
          <p className="font-display text-[22px] font-semibold tabular-nums leading-tight" style={{ color: "var(--muted)" }}>
            {fmtEur(rij.vergelijking.omzet)}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {rij.vergelijking.txs.toLocaleString("nl-NL")} tx · {fmtEur(rij.vergelijking.gemBon)}/bon
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {rij.vergelijking.label}
          </p>
        </div>
      </div>

      <div className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--sf-hairline)" }}>
        <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
          Breakdown
        </p>
        <DetailRegel label="Verschil omzet" waarde={`${verschilEur > 0 ? "+" : ""}${fmtEur(verschilEur)}`} groen={verschilEur > 0} />
        <DetailRegel label="Verschil transacties" waarde={`${verschilTxs > 0 ? "+" : ""}${verschilTxs.toLocaleString("nl-NL")}`} groen={verschilTxs > 0} />
        <DetailRegel
          label="Verschil gem. bon"
          waarde={`${verschilBon > 0 ? "+" : ""}${fmtEur(verschilBon)}`}
          groen={verschilBon > 0}
        />
      </div>

      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Alle bedragen zijn incl. btw. Vergelijkingen gebruiken hetzelfde tijdvenster
        binnen de referentieperiode — appels met appels.
      </p>
    </div>
  );
}

function DetailRegel({ label, waarde, groen }: { label: string; waarde: string; groen: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px]" style={{ color: "var(--muted)" }}>{label}</span>
      <span
        className="font-mono text-[12px] font-medium tabular-nums"
        style={{ color: groen ? "var(--sf-success)" : "var(--sf-danger)" }}
      >
        {waarde}
      </span>
    </div>
  );
}
