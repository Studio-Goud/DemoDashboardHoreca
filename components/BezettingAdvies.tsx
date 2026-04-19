"use client";

import { useState } from "react";
import type { BezettingPerWeekdag, WeekdagShiftProfiel } from "@/lib/shiftbase";
import type { DagOmzet, Prognose } from "@/lib/analytics";

interface Props {
  hex: string;
  weekdagStats: BezettingPerWeekdag[];
  bezettingPerDag: { datum: string; aantalMensen: number }[];
  dagOmzet: DagOmzet[];
  prognose: Prognose[];
  komendeDiensten: { datum: string; label: string; mensen: string[]; aantalMensen: number }[];
  shiftProfielen: WeekdagShiftProfiel[];
}

const DAG_KORT = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

function fmt(n: number) {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Selecteer de juiste shifts voor een aanbevolen headcount op basis van historisch profiel.
// Kies shifts die de dag optimaal afdekken (opener, middag, sluiter).
function selecteerShifts(
  profiel: WeekdagShiftProfiel | undefined,
  aanbevolen: number
): { start: string; eind: string; rol: string }[] {
  if (!profiel || profiel.shifts.length === 0 || aanbevolen === 0) return [];

  const alle = profiel.shifts;

  // Categoriseer shifts
  const openers  = alle.filter((s) => s.start <= "10:30");
  const middag   = alle.filter((s) => s.start > "10:30" && s.start <= "13:30");
  const sluiters = alle.filter((s) => s.start > "13:30");

  const result: { start: string; eind: string; rol: string; freq: number }[] = [];

  // Altijd een opener (meest frequente vroege shift)
  const opener = openers.sort((a, b) => b.freq - a.freq)[0] ?? alle[0];
  result.push({ ...opener, rol: "openen" });

  if (aanbevolen >= 2) {
    // 2e persoon: middagshift of 2e vroege
    const tweede =
      middag.sort((a, b) => b.freq - a.freq)[0] ??
      sluiters.sort((a, b) => b.freq - a.freq)[0] ??
      alle.find((s) => s.start !== opener.start);
    if (tweede) result.push({ ...tweede, rol: "middag" });
  }

  if (aanbevolen >= 3) {
    // 3e persoon: sluiter (meest frequente late shift die nog niet in lijst zit)
    const gebruikte = new Set(result.map((r) => `${r.start}-${r.eind}`));
    const sluiter =
      sluiters
        .sort((a, b) => b.freq - a.freq)
        .find((s) => !gebruikte.has(`${s.start}-${s.eind}`)) ??
      middag
        .sort((a, b) => b.freq - a.freq)
        .find((s) => !gebruikte.has(`${s.start}-${s.eind}`));
    if (sluiter) result.push({ ...sluiter, rol: "sluiten" });
  }

  if (aanbevolen >= 4) {
    // Extra mensen: vul aan met meest voorkomende shifts die nog niet gekozen zijn
    const gebruikte = new Set(result.map((r) => `${r.start}-${r.eind}`));
    for (const shift of alle.sort((a, b) => b.freq - a.freq)) {
      if (result.length >= aanbevolen) break;
      if (!gebruikte.has(`${shift.start}-${shift.eind}`)) {
        result.push({ ...shift, rol: "extra" });
        gebruikte.add(`${shift.start}-${shift.eind}`);
      }
    }
    // Nog steeds te weinig → herhaal populairste shifts
    if (result.length < aanbevolen) {
      const populairste = alle[0];
      while (result.length < aanbevolen) {
        result.push({ ...populairste, rol: "extra" });
      }
    }
  }

  return result
    .slice(0, aanbevolen)
    .sort((a, b) => a.start.localeCompare(b.start));
}

const ROL_KLEUR: Record<string, string> = {
  openen: "#60a5fa",
  middag: "#a78bfa",
  sluiten: "#34d399",
  extra: "#94a3b8",
};

export default function BezettingAdvies({
  hex, weekdagStats, bezettingPerDag, dagOmzet, prognose, komendeDiensten, shiftProfielen,
}: Props) {
  const [uitgebreid, setUitgebreid] = useState(false);

  // Omzet-per-persoon per weekdag (historisch)
  const omzetMap = new Map(dagOmzet.map((d) => [d.datum, d.omzet]));
  const wdRatio: Record<number, { som: number; n: number }> = {};
  for (const bz of bezettingPerDag) {
    const omzet = omzetMap.get(bz.datum);
    if (!omzet || bz.aantalMensen === 0) continue;
    const wd = new Date(bz.datum).getDay();
    if (!wdRatio[wd]) wdRatio[wd] = { som: 0, n: 0 };
    wdRatio[wd].som += omzet / bz.aantalMensen;
    wdRatio[wd].n++;
  }
  const omzetPerPersoon: Record<number, number> = {};
  for (const [wdStr, v] of Object.entries(wdRatio)) {
    omzetPerPersoon[Number(wdStr)] = v.n > 0 ? v.som / v.n : 0;
  }

  const vandaagStr  = new Date().toISOString().slice(0, 10);
  const geplandMap  = new Map(komendeDiensten.map((d) => [d.datum, d]));
  const profielMap  = new Map(shiftProfielen.map((p) => [p.weekdag, p]));

  const dagLijst = prognose
    .filter((p) => p.datum >= vandaagStr)
    .slice(0, 14);

  // Bereken per dag
  const dagData = dagLijst.map((dag) => {
    const ratio      = omzetPerPersoon[dag.weekdag] ?? 0;
    const aanbevolen = ratio > 0 ? Math.max(1, Math.ceil(dag.verwacht / ratio)) : null;
    const gepland    = geplandMap.get(dag.datum);
    const profiel    = profielMap.get(dag.weekdag);
    const shifts     = aanbevolen !== null ? selecteerShifts(profiel, aanbevolen) : [];

    const status = (() => {
      if (!gepland || aanbevolen === null) return null;
      const diff = gepland.aantalMensen - aanbevolen;
      if (diff < -1) return { kleur: "#f87171", icon: "⚠", tekst: `${diff} te weinig` };
      if (diff > 1)  return { kleur: "#fbbf24", icon: "↑", tekst: `+${diff} extra` };
      return { kleur: "#4ade80", icon: "✓", tekst: "op schema" };
    })();

    return { dag, aanbevolen, gepland, shifts, status, profiel };
  });

  const vandaag = dagData[0];
  const zichtbaar = uitgebreid ? dagData : dagData.slice(0, 7);

  return (
    <div className="card space-y-5" style={{ borderColor: hex + "33" }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">👥</span>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: hex }}>
          Personeelsadvies
        </h2>
        <span className="text-xs text-slate-500 ml-auto">14 dagen vooruit</span>
      </div>

      {/* Vandaag highlight */}
      {vandaag && vandaag.dag.datum === vandaagStr && vandaag.aanbevolen !== null && (
        <div className="rounded-xl px-4 py-4 space-y-3" style={{ background: hex + "15" }}>
          <div className="flex flex-wrap gap-6 items-start">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Vandaag aanbevolen</p>
              <p className="text-4xl font-bold font-mono" style={{ color: hex }}>
                {vandaag.aanbevolen}
                <span className="text-base font-normal text-slate-400 ml-1.5">mensen</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Verwacht {fmt(vandaag.dag.verwacht)} · {fmt(omzetPerPersoon[vandaag.dag.weekdag] ?? 0)}/persoon gem.
              </p>
            </div>
            {vandaag.gepland && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gepland (Shiftbase)</p>
                <p className="text-2xl font-semibold font-mono text-slate-200">
                  {vandaag.gepland.aantalMensen}
                  <span className="text-sm font-normal text-slate-400 ml-1">mensen</span>
                </p>
                {vandaag.status && (
                  <p className="text-xs font-semibold mt-0.5" style={{ color: vandaag.status.kleur }}>
                    {vandaag.status.icon} {vandaag.status.tekst}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Shift-advies vandaag */}
          {vandaag.shifts.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Optimale dienstindeling</p>
              <div className="flex flex-wrap gap-2">
                {vandaag.shifts.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-mono font-semibold"
                    style={{ background: ROL_KLEUR[s.rol] + "22", color: ROL_KLEUR[s.rol], border: `1px solid ${ROL_KLEUR[s.rol]}44` }}
                  >
                    <span>{s.start}–{s.eind}</span>
                    <span className="text-[10px] opacity-70 capitalize">{s.rol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 14-dagenoverzicht */}
      <div className="space-y-3">
        {zichtbaar.map(({ dag, aanbevolen, gepland, shifts, status }) => {
          const isVandaag = dag.datum === vandaagStr;
          if (isVandaag) return null; // vandaag al bovenaan getoond

          return (
            <div
              key={dag.datum}
              className="rounded-lg px-3 py-2.5 space-y-1.5"
              style={{ background: "#0d1117" }}
            >
              {/* Dag header */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-slate-400 w-16">
                  {DAG_KORT[dag.weekdag]} {dag.datum.slice(8)}/{dag.datum.slice(5, 7)}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {fmt(dag.verwacht)}
                </span>
                {dag.feestdag && (
                  <span className="text-[10px] text-amber-400">{dag.feestdag}</span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {aanbevolen !== null && (
                    <span className="font-mono text-[11px] font-bold text-slate-200">
                      {aanbevolen}p aanbevolen
                    </span>
                  )}
                  {gepland && (
                    <span className="font-mono text-[11px] text-slate-500">
                      · {gepland.aantalMensen}p gepland
                    </span>
                  )}
                  {status && (
                    <span className="text-[11px] font-semibold" style={{ color: status.kleur }}>
                      {status.icon}
                    </span>
                  )}
                </span>
              </div>

              {/* Shift-advies */}
              {shifts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-0">
                  {shifts.map((s, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                      style={{ background: ROL_KLEUR[s.rol] + "18", color: ROL_KLEUR[s.rol] }}
                    >
                      {s.start}–{s.eind}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dagData.length > 7 && (
        <button
          onClick={() => setUitgebreid(!uitgebreid)}
          className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
        >
          {uitgebreid ? "Minder tonen ↑" : `Meer tonen (${dagData.length - 7} dagen) ↓`}
        </button>
      )}

      <p className="text-[10px] text-slate-700">
        Shift-tijden zijn de meest voorkomende diensten uit Shiftbase-historie per weekdag.
        Aanbeveling = verwachte omzet ÷ historisch gem. omzet per medewerker.
      </p>
    </div>
  );
}
