"use client";

import { useState } from "react";
import type { ProductCombi } from "@/lib/analytics";
import DetailSheet from "./sf/DetailSheet";

interface Props {
  data: ProductCombi[];
  hex: string;
}

export default function ProductCombinaties({ data, hex }: Props) {
  const [toonAll, setToonAll] = useState(false);
  const [actief, setActief] = useState<ProductCombi | null>(null);

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-700 mb-1">
          Product-combinaties
        </h3>
        <p className="text-[11px] text-slate-400">
          Nog onvoldoende bons met meerdere producten voor zinvolle
          combinatie-analyse.
        </p>
      </div>
    );
  }

  const zichtbaar = toonAll ? data.slice(0, 50) : data.slice(0, 10);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold text-slate-700">Product-combinaties</h3>
        <span className="text-[11px] text-slate-400">
          gesorteerd op lift · {data.length} combinaties
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Welke producten worden vaak sámen afgerekend.{" "}
        <span className="font-medium">Confidence</span> = % van bonnen met het
        eerste product waarin ook het tweede zit.{" "}
        <span className="font-medium">Lift</span> &gt; 1 betekent dat de combi
        vaker voorkomt dan willekeurig toeval.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2">Combinatie</th>
              <th className="text-right py-2 px-2">Samen</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">
                Confidence A→B
              </th>
              <th className="text-right py-2 px-2 hidden md:table-cell">
                Confidence B→A
              </th>
              <th className="text-right py-2 pl-2">Lift</th>
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map((c, i) => (
              <tr
                key={`${c.a}-${c.b}`}
                onClick={() => setActief(c)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="py-2 pr-2 text-slate-400 tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2 max-w-[320px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-800">{c.a}</span>
                    <span
                      className="text-slate-400 font-bold"
                      style={{ color: hex }}
                    >
                      +
                    </span>
                    <span className="text-slate-800">{c.b}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {c.samen.toLocaleString("nl-NL")}
                </td>
                <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell text-slate-700">
                  {(c.confidenceAB * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell text-slate-700">
                  {(c.confidenceBA * 100).toFixed(0)}%
                </td>
                <td
                  className={`py-2 pl-2 text-right tabular-nums font-semibold ${
                    c.lift >= 2
                      ? "text-emerald-600"
                      : c.lift >= 1.2
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {c.lift.toFixed(2)}×
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length > 10 && (
        <button
          onClick={() => setToonAll((v) => !v)}
          className="mt-3 text-[11px] text-slate-500 hover:text-slate-700"
        >
          {toonAll
            ? "← Toon top 10"
            : `Toon top 50 combinaties →`}
        </button>
      )}

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief ? `${actief.a} + ${actief.b}` : ""}
        subtitel={actief ? `${actief.samen.toLocaleString("nl-NL")}× samen verkocht` : ""}
        hex={hex}
      >
        {actief && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
              <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                Lift
              </p>
              <p
                className="font-display text-[36px] font-semibold tabular-nums leading-none"
                style={{ color: hex, letterSpacing: "-0.018em" }}
              >
                {actief.lift.toFixed(2)}×
              </p>
              <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                {actief.lift >= 2
                  ? "Sterke combinatie — komt veel vaker samen voor dan willekeurig"
                  : actief.lift >= 1.2
                  ? "Significant samen — boven willekeur"
                  : actief.lift >= 0.8
                  ? "Ongeveer willekeurig"
                  : "Komt zelden samen voor — mogelijk substituten"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                  Als A → B
                </p>
                <p className="font-display text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {(actief.confidenceAB * 100).toFixed(0)}%
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                  Van {actief.aVolume} bonnen met <strong>{actief.a}</strong>, zit {actief.b} er ook in
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                  Als B → A
                </p>
                <p className="font-display text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {(actief.confidenceBA * 100).toFixed(0)}%
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                  Van {actief.bVolume} bonnen met <strong>{actief.b}</strong>, zit {actief.a} er ook in
                </p>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
              <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                Samen verkocht
              </p>
              <p className="text-[13px]" style={{ color: "var(--text)" }}>
                <strong>{actief.samen.toLocaleString("nl-NL")}</strong> keer in dezelfde bon.
              </p>
            </div>

            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {actief.lift >= 1.5
                ? "Tip: overweeg een bundle-aanbieding of plaats deze producten dichter bij elkaar op de menukaart. De klant koopt ze toch al vaak samen."
                : actief.lift < 0.8
                ? "Tip: deze producten worden zelden samen gekocht — mogelijk substitueerbaar. Beslis welke je centraal stelt en hoe je de ander positioneert."
                : "Lift rond 1.0 = neutraal. Geen aanleiding voor specifieke actie, maar wel handig om te weten."}
            </p>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
