"use client";

import type { BezettingPerWeekdag } from "@/lib/shiftbase";
import type { DagOmzet, Prognose } from "@/lib/analytics";

interface Props {
  hex: string;
  weekdagStats: BezettingPerWeekdag[];
  bezettingPerDag: { datum: string; aantalMensen: number }[];
  dagOmzet: DagOmzet[];
  prognose: Prognose[];
  komendeDiensten: { datum: string; label: string; mensen: string[]; aantalMensen: number }[];
}

const DAG_NL = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

function fmt(n: number) {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BezettingAdvies({
  hex, weekdagStats, bezettingPerDag, dagOmzet, prognose, komendeDiensten,
}: Props) {
  // Stap 1: omzet-per-persoon per weekdag (historisch)
  // = gem dagomzet voor dit bedrijf / gem totaal mensen die dag
  const omzetMap = new Map(dagOmzet.map((d) => [d.datum, d.omzet]));

  // Per weekdag: gem (omzet / mensen) van alle overlap-dagen
  const wdRatio: Record<number, { som: number; n: number }> = {};
  for (const bz of bezettingPerDag) {
    const omzet = omzetMap.get(bz.datum);
    if (!omzet || bz.aantalMensen === 0) continue;
    const wd = new Date(bz.datum).getDay();
    if (!wdRatio[wd]) wdRatio[wd] = { som: 0, n: 0 };
    wdRatio[wd].som += omzet / bz.aantalMensen;
    wdRatio[wd].n++;
  }

  // omzetPerPersoon per weekdag = historisch gem
  const omzetPerPersoon: Record<number, number> = {};
  for (const [wdStr, v] of Object.entries(wdRatio)) {
    omzetPerPersoon[Number(wdStr)] = v.n > 0 ? v.som / v.n : 0;
  }

  // Stap 2: bouw 14-dagenlijst vanuit prognose
  const vandaagStr = new Date().toISOString().slice(0, 10);
  const geplandMap = new Map(komendeDiensten.map((d) => [d.datum, d]));

  // Neem prognose-dagen (al gesorteerd), max 14 vanaf vandaag
  const dagLijst = prognose
    .filter((p) => p.datum >= vandaagStr)
    .slice(0, 14);

  const heeftGepland = komendeDiensten.some((d) => d.datum >= vandaagStr);

  return (
    <div className="card space-y-4" style={{ borderColor: hex + "33" }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">👥</span>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: hex }}>
          Personeelsplanning
        </h2>
        <span className="text-xs text-slate-500 ml-auto">komende 14 dagen</span>
      </div>

      {/* Legenda */}
      <p className="text-[11px] text-slate-500">
        Aanbeveling = verwachte omzet ÷ historisch gem. omzet/persoon per weekdag.
        Bezetting is bedrijf-overstijgend (alle Studio Goud medewerkers).
      </p>

      {/* Daglijst */}
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-[56px_1fr_72px_64px_64px] gap-x-2 text-[10px] text-slate-600 uppercase tracking-wider pb-1 border-b border-slate-800">
          <span>Datum</span>
          <span>Verwacht</span>
          <span className="text-right">Aanbevolen</span>
          <span className="text-right">Gepland</span>
          <span className="text-right">Status</span>
        </div>

        {dagLijst.length === 0 && (
          <p className="text-xs text-slate-500 py-2">Geen prognosedata beschikbaar.</p>
        )}

        {dagLijst.map((dag) => {
          const ratioWd   = omzetPerPersoon[dag.weekdag] ?? 0;
          const aanbevolen = ratioWd > 0 ? Math.ceil(dag.verwacht / ratioWd) : null;
          const gepland    = geplandMap.get(dag.datum);
          const isVandaag  = dag.datum === vandaagStr;

          const status = (() => {
            if (!gepland || aanbevolen === null) return null;
            const diff = gepland.aantalMensen - aanbevolen;
            if (diff < -1) return { label: `${diff}`, kleur: "#f87171", icon: "⚠" };
            if (diff > 1)  return { label: `+${diff}`, kleur: "#fbbf24", icon: "↑" };
            return { label: "✓", kleur: "#4ade80", icon: "" };
          })();

          return (
            <div
              key={dag.datum}
              className={`grid grid-cols-[56px_1fr_72px_64px_64px] gap-x-2 items-center py-1 text-[11px] rounded ${isVandaag ? "bg-slate-800/60" : ""}`}
            >
              {/* Datum */}
              <span
                className="font-mono font-semibold"
                style={isVandaag ? { color: hex } : { color: "#64748b" }}
              >
                {DAG_NL[dag.weekdag]} {dag.datum.slice(8)}/{dag.datum.slice(5, 7)}
              </span>

              {/* Verwacht omzet + bar */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="h-1.5 rounded-full bg-slate-800 w-full max-w-[80px] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((dag.verwacht / 3000) * 100))}%`,
                      background: hex,
                      opacity: 0.6,
                    }}
                  />
                </div>
                <span className="font-mono text-slate-300 whitespace-nowrap">{fmt(dag.verwacht)}</span>
                {dag.feestdag && <span className="text-[9px] text-amber-400 truncate">{dag.feestdag}</span>}
              </div>

              {/* Aanbevolen */}
              <span className="font-mono text-slate-200 text-right">
                {aanbevolen !== null ? `${aanbevolen}p` : <span className="text-slate-600">–</span>}
              </span>

              {/* Gepland */}
              <span className="font-mono text-right">
                {gepland ? (
                  <span className="text-slate-200">{gepland.aantalMensen}p</span>
                ) : (
                  <span className="text-slate-700">–</span>
                )}
              </span>

              {/* Status */}
              <span className="font-mono font-bold text-right" style={status ? { color: status.kleur } : {}}>
                {status ? (status.icon ? `${status.icon} ${status.label}` : status.label) : ""}
              </span>
            </div>
          );
        })}
      </div>

      {!heeftGepland && (
        <p className="text-[11px] text-slate-600 italic">
          Geen Shiftbase-diensten gevonden voor de komende 14 dagen — voeg een nieuwe CSV-export toe om planning te vergelijken.
        </p>
      )}

      {/* Vandaag highlight */}
      {(() => {
        const vandaag = dagLijst[0];
        if (!vandaag || vandaag.datum !== vandaagStr) return null;
        const ratioWd    = omzetPerPersoon[vandaag.weekdag] ?? 0;
        const aanbevolen = ratioWd > 0 ? Math.ceil(vandaag.verwacht / ratioWd) : null;
        const gepland    = geplandMap.get(vandaagStr);
        if (aanbevolen === null) return null;
        return (
          <div
            className="rounded-lg px-4 py-3 flex flex-wrap gap-4 items-center mt-1"
            style={{ background: hex + "18" }}
          >
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Aanbevolen vandaag</p>
              <p className="text-3xl font-bold font-mono" style={{ color: hex }}>
                {aanbevolen}
                <span className="text-base font-normal text-slate-400 ml-1">mensen</span>
              </p>
            </div>
            {gepland && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gepland in Shiftbase</p>
                <p className="text-2xl font-semibold font-mono text-slate-200">
                  {gepland.aantalMensen}
                  <span className="text-sm font-normal text-slate-400 ml-1">mensen</span>
                </p>
                {gepland.mensen.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {gepland.mensen.slice(0, 5).join(", ")}{gepland.mensen.length > 5 ? ` +${gepland.mensen.length - 5}` : ""}
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Basis</p>
              <p className="text-xs font-mono text-slate-400">
                {fmt(ratioWd)}/persoon (gem. {DAG_NL[vandaag.weekdag]})
              </p>
              <p className="text-xs font-mono text-slate-400">
                Verwacht {fmt(vandaag.verwacht)} vandaag
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
