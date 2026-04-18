"use client";

import { useState } from "react";
import type { ProductCombi } from "@/lib/analytics";

interface Props {
  data: ProductCombi[];
  hex: string;
}

export default function ProductCombinaties({ data, hex }: Props) {
  const [toonAll, setToonAll] = useState(false);

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
                className="border-b border-slate-100 hover:bg-slate-50"
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
    </div>
  );
}
