"use client";

import { useState, useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import type { ProductData } from "@/lib/analytics";

interface Props {
  data: ProductData[];
  hex: string;
}

type SortKey = "omzet" | "aantal" | "gemPrijs" | "trend";

export default function ProductsTable({ data, hex }: Props) {
  const [zoek, setZoek] = useState("");
  const [sort, setSort] = useState<SortKey>("omzet");
  const [toonAll, setToonAll] = useState(false);

  const gefilterd = useMemo(() => {
    const q = zoek.toLowerCase().trim();
    let lijst = q
      ? data.filter((p) => p.naam.toLowerCase().includes(q))
      : [...data];
    lijst.sort((a, b) => (b[sort] as number) - (a[sort] as number));
    return lijst;
  }, [data, zoek, sort]);

  const zichtbaar = toonAll ? gefilterd : gefilterd.slice(0, 15);

  const totaalOmzet = data.reduce((s, p) => s + p.omzet, 0);
  const totaalAantal = data.reduce((s, p) => s + p.aantal, 0);
  const max = gefilterd[0]?.omzet ?? 1;

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-white/80">
            Producten ({data.length})
          </h3>
          <p className="text-[11px] text-white/30">
            Totaal €
            {totaalOmzet.toLocaleString("nl-NL", {
              maximumFractionDigits: 0,
            })}{" "}
            · {totaalAantal.toLocaleString("nl-NL")} stuks verkocht
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek product…"
            className="bg-white/5 border border-white/10 rounded-md px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 w-40"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="omzet">Omzet</option>
            <option value="aantal">Aantal</option>
            <option value="gemPrijs">Gem. prijs</option>
            <option value="trend">Trend</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-white/40 border-b border-white/5">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2">Product</th>
              <th className="text-right py-2 px-2">Omzet</th>
              <th className="text-right py-2 px-2">Aandeel</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">
                Aantal
              </th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">
                Gem. €
              </th>
              <th className="text-right py-2 px-2">Trend 30d</th>
              <th className="text-right py-2 pl-2 hidden md:table-cell">
                Laatst
              </th>
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map((p, i) => {
              const trendKleur =
                p.trend > 10
                  ? "text-green-400"
                  : p.trend < -10
                  ? "text-red-400"
                  : "text-white/40";
              const dagenTerug = p.laatstVerkocht
                ? differenceInDays(new Date(), parseISO(p.laatstVerkocht))
                : null;
              return (
                <tr
                  key={p.naam}
                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                >
                  <td className="py-2 pr-2 text-white/30 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-2 max-w-[220px]">
                    <div className="truncate text-white/85" title={p.naam}>
                      {p.naam}
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.omzet / max) * 100}%`,
                          backgroundColor: hex,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    €
                    {p.omzet.toLocaleString("nl-NL", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 px-2 text-right text-white/50 tabular-nums">
                    {p.aandeel.toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">
                    {p.aantal.toLocaleString("nl-NL")}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell text-white/70">
                    €{p.gemPrijs.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-2 text-right tabular-nums ${trendKleur}`}
                  >
                    {p.trend > 0 ? "▲ +" : p.trend < 0 ? "▼ " : "• "}
                    {p.trend}%
                  </td>
                  <td className="py-2 pl-2 text-right text-white/40 hidden md:table-cell tabular-nums text-[11px]">
                    {p.laatstVerkocht
                      ? dagenTerug === 0
                        ? "vandaag"
                        : dagenTerug === 1
                        ? "gisteren"
                        : `${dagenTerug}d`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {zichtbaar.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-4 text-center text-white/30 text-sm"
                >
                  Geen producten gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {gefilterd.length > 15 && (
        <button
          onClick={() => setToonAll((v) => !v)}
          className="mt-3 text-[11px] text-white/50 hover:text-white/80 transition-colors"
        >
          {toonAll
            ? "← Toon top 15"
            : `Toon alle ${gefilterd.length} producten →`}
        </button>
      )}
    </div>
  );
}
