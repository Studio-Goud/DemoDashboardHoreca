"use client";

import type { BezettingPerWeekdag } from "@/lib/shiftbase";
import type { DagOmzet } from "@/lib/analytics";

interface Props {
  hex: string;
  weekdagStats: BezettingPerWeekdag[];
  // { datum, aantalMensen } — alle historische dagbezettingen
  bezettingPerDag: { datum: string; aantalMensen: number }[];
  dagOmzet: DagOmzet[];
  vandaagBezetting: number | null;
  komendeDiensten: { datum: string; label: string; mensen: string[]; aantalMensen: number }[];
}

const DAG_AFKORT = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

function fmt(n: number) {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function BezettingAdvies({
  hex, weekdagStats, bezettingPerDag, dagOmzet, vandaagBezetting, komendeDiensten,
}: Props) {
  // Join bezetting + omzet per datum voor correlatie
  const omzetMap = new Map(dagOmzet.map((d) => [d.datum, d.omzet]));

  // Per weekdag: gem omzet totaal (alle 3 bedrijven worden doorgespeeld maar dit is per bedrijf)
  // Per weekdag: gem bezetting
  const wdStats = weekdagStats.map((wd) => {
    // Verzamel alle (bezetting, omzet)-paren voor deze weekdag
    const paren: { mensen: number; omzet: number }[] = [];
    for (const bz of bezettingPerDag) {
      const omzet = omzetMap.get(bz.datum);
      if (omzet == null) continue;
      const d = new Date(bz.datum);
      const dWd = d.getDay(); // 0=zo
      if (dWd !== wd.weekdag) continue;
      paren.push({ mensen: bz.aantalMensen, omzet });
    }
    const gemOmzet =
      paren.length > 0
        ? paren.reduce((s, p) => s + p.omzet, 0) / paren.length
        : 0;
    const omzetPerPersoon = wd.gemMensen > 0 ? gemOmzet / wd.gemMensen : 0;

    return {
      ...wd,
      gemOmzet,
      omzetPerPersoon,
      nDagen: paren.length,
    };
  });

  const vandaagWd = new Date().getDay();
  const vandaagStats = wdStats.find((w) => w.weekdag === vandaagWd);

  const maxOmzet = Math.max(...wdStats.map((w) => w.gemOmzet), 1);

  return (
    <div
      className="card space-y-5"
      style={{ borderColor: hex + "33" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">👥</span>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: hex }}>
          Bezetting & Omzet
        </h2>
        <span className="text-xs text-slate-500 ml-auto">alle bedrijven gecombineerd</span>
      </div>

      {/* Vandaag */}
      {vandaagBezetting !== null && (
        <div
          className="rounded-lg px-4 py-3 flex items-center justify-between"
          style={{ background: hex + "15" }}
        >
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Vandaag gepland</p>
            <p className="text-2xl font-bold font-mono" style={{ color: hex }}>
              {vandaagBezetting} <span className="text-sm font-normal text-slate-400">mensen</span>
            </p>
          </div>
          {vandaagStats && (
            <div className="text-right">
              <p className="text-xs text-slate-400">Historisch gem. vandaag</p>
              <p className="text-lg font-semibold font-mono text-slate-200">
                {vandaagStats.gemMensen} mensen
              </p>
              <p className="text-xs text-slate-400">
                gem. omzet {fmt(vandaagStats.gemOmzet)} ({vandaagStats.nDagen} weken)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Per weekdag tabel */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Weekdag overzicht</p>
        <div className="space-y-1.5">
          {wdStats.map((wd) => (
            <div key={wd.weekdag} className="flex items-center gap-2 group">
              <span
                className={`text-[11px] font-mono w-6 shrink-0 ${wd.weekdag === vandaagWd ? "font-bold" : "text-slate-500"}`}
                style={wd.weekdag === vandaagWd ? { color: hex } : {}}
              >
                {DAG_AFKORT[wd.weekdag]}
              </span>
              <span className="text-[11px] font-mono text-slate-300 w-10 shrink-0 text-right">
                {wd.gemMensen}p
              </span>
              {/* Bar */}
              <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((wd.gemOmzet / maxOmzet) * 100)}%`,
                    background: hex,
                    opacity: wd.nDagen > 0 ? 0.8 : 0.2,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-400 w-20 shrink-0 text-right">
                {wd.nDagen > 0 ? fmt(wd.gemOmzet) : "–"}
              </span>
              <span className="text-[10px] font-mono text-slate-600 w-16 shrink-0 text-right hidden sm:block">
                {wd.nDagen > 0 && wd.gemMensen > 0 ? `${fmt(wd.omzetPerPersoon)}/p` : ""}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          Gemiddeld aantal mensen (Shiftbase) · gem. dagomzet dit bedrijf · omzet per gepland persoon
        </p>
      </div>

      {/* Komende diensten */}
      {komendeDiensten.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Planning komende dagen</p>
          <div className="space-y-1">
            {komendeDiensten.slice(0, 7).map((d) => (
              <div key={d.datum} className="flex items-start gap-2 text-[11px]">
                <span
                  className="font-mono text-slate-400 w-24 shrink-0"
                  style={d.datum === new Date().toISOString().slice(0, 10) ? { color: hex } : {}}
                >
                  {d.label}
                </span>
                <span className="font-mono font-bold text-slate-200 w-5 shrink-0">
                  {d.aantalMensen}
                </span>
                <span className="text-slate-500 truncate">
                  {d.mensen.slice(0, 4).join(", ")}
                  {d.mensen.length > 4 ? ` +${d.mensen.length - 4}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
