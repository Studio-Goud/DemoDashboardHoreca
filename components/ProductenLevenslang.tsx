"use client";

import { useMemo, useState } from "react";
import type { ProductLevens } from "@/lib/zettle-excel";
import DetailSheet from "./sf/DetailSheet";

interface Props {
  data: ProductLevens[];
  hex: string;
  periodeLabel: string;
}

type SortKey = "omzetInclBtw" | "aantalVerkocht" | "winst" | "winstmarge";

export default function ProductenLevenslang({
  data,
  hex,
  periodeLabel,
}: Props) {
  const [zoek, setZoek] = useState("");
  const [sort, setSort] = useState<SortKey>("omzetInclBtw");
  const [categorie, setCategorie] = useState<string>("");
  const [toonAll, setToonAll] = useState(false);
  const [actief, setActief] = useState<{ p: ProductLevens; rang: number } | null>(null);

  const categorieen = useMemo(() => {
    const s = new Set<string>();
    for (const p of data) if (p.categorie) s.add(p.categorie);
    return Array.from(s).sort();
  }, [data]);

  const gefilterd = useMemo(() => {
    const q = zoek.toLowerCase().trim();
    let lijst = data.filter(
      (p) =>
        (!q ||
          p.naam.toLowerCase().includes(q) ||
          p.variant.toLowerCase().includes(q)) &&
        (!categorie || p.categorie === categorie)
    );
    lijst.sort((a, b) => {
      const av = a[sort] ?? 0;
      const bv = b[sort] ?? 0;
      return (bv as number) - (av as number);
    });
    return lijst;
  }, [data, zoek, sort, categorie]);

  const totaalOmzet = data.reduce((s, p) => s + p.omzetInclBtw, 0);
  const totaalAantal = data.reduce((s, p) => s + p.aantalVerkocht, 0);
  const totaalKortingen = data.reduce((s, p) => s + p.kortingen, 0);
  const totaalWinst = data.reduce((s, p) => s + (p.winst ?? 0), 0);

  const zichtbaar = toonAll ? gefilterd : gefilterd.slice(0, 25);
  const max = gefilterd[0]?.omzetInclBtw ?? 1;

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">
            Alle producten ({data.length}) — lifetime
          </h3>
          <p className="text-[11px] text-slate-400">
            Periode: {periodeLabel} · €
            {totaalOmzet.toLocaleString("nl-NL", {
              maximumFractionDigits: 0,
            })}{" "}
            · {totaalAantal.toLocaleString("nl-NL")} verkocht
            {totaalKortingen > 0 &&
              ` · kortingen €${totaalKortingen.toLocaleString("nl-NL", {
                maximumFractionDigits: 0,
              })}`}
            {totaalWinst > 0 &&
              ` · winst €${totaalWinst.toLocaleString("nl-NL", {
                maximumFractionDigits: 0,
              })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek product…"
            className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 w-40"
          />
          {categorieen.length > 0 && (
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none"
            >
              <option value="">Alle categorieën</option>
              {categorieen.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none"
          >
            <option value="omzetInclBtw">Omzet</option>
            <option value="aantalVerkocht">Aantal</option>
            <option value="winst">Winst</option>
            <option value="winstmarge">Marge</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2">Product</th>
              <th className="text-left py-2 hidden md:table-cell">Categorie</th>
              <th className="text-right py-2 px-2">Omzet incl</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">
                Aantal
              </th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">
                Gem. €
              </th>
              <th className="text-right py-2 px-2 hidden md:table-cell">
                Winst
              </th>
              <th className="text-right py-2 pl-2 hidden md:table-cell">
                Marge
              </th>
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map((p, i) => {
              const gem =
                p.aantalVerkocht > 0
                  ? p.omzetInclBtw / p.aantalVerkocht
                  : 0;
              const aandeel = (p.omzetInclBtw / Math.max(totaalOmzet, 1)) * 100;
              return (
                <tr
                  key={`${p.naam}-${p.variant}-${i}`}
                  onClick={() => setActief({ p, rang: i + 1 })}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-2 pr-2 text-slate-400 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-2 max-w-[240px]">
                    <div className="text-slate-800 truncate" title={p.naam}>
                      {p.naam}
                      {p.variant && (
                        <span className="text-slate-400 text-[11px]">
                          {" "}
                          · {p.variant}
                        </span>
                      )}
                    </div>
                    <div className="h-1 bg-slate-50 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.omzetInclBtw / max) * 100}%`,
                          backgroundColor: hex,
                          opacity: 0.75,
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2 text-slate-400 text-[11px] hidden md:table-cell">
                    {p.categorie || "—"}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    €
                    {p.omzetInclBtw.toLocaleString("nl-NL", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    <div className="text-[10px] text-slate-400">
                      {aandeel.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell">
                    {p.aantalVerkocht.toLocaleString("nl-NL")}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums hidden sm:table-cell text-slate-600">
                    €{gem.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">
                    {p.winst !== null
                      ? `€${p.winst.toLocaleString("nl-NL", {
                          maximumFractionDigits: 0,
                        })}`
                      : "—"}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums hidden md:table-cell">
                    {p.winstmarge !== null
                      ? `${(p.winstmarge * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {zichtbaar.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-4 text-center text-slate-400 text-sm"
                >
                  Geen producten gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {gefilterd.length > 25 && (
        <button
          onClick={() => setToonAll((v) => !v)}
          className="mt-3 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
        >
          {toonAll
            ? "← Toon top 25"
            : `Toon alle ${gefilterd.length} producten →`}
        </button>
      )}

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief ? `${actief.p.naam}${actief.p.variant ? ` · ${actief.p.variant}` : ""}` : ""}
        subtitel={actief ? `Rang #${actief.rang} · ${actief.p.categorie || "geen categorie"}` : ""}
        hex={hex}
      >
        {actief && (() => {
          const p = actief.p;
          const gem = p.aantalVerkocht > 0 ? p.omzetInclBtw / p.aantalVerkocht : 0;
          const aandeel = (p.omzetInclBtw / Math.max(totaalOmzet, 1)) * 100;
          return (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
                <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                  Lifetime omzet (incl. btw)
                </p>
                <p
                  className="font-display text-[32px] font-semibold tabular-nums leading-none"
                  style={{ color: hex, letterSpacing: "-0.018em" }}
                >
                  €{p.omzetInclBtw.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
                </p>
                <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  {aandeel.toFixed(1)}% van de totale productomzet
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                  <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                    Aantal verkocht
                  </p>
                  <p className="font-display text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {p.aantalVerkocht.toLocaleString("nl-NL")}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                  <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                    Gem. prijs
                  </p>
                  <p className="font-display text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    €{gem.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--sf-hairline)" }}>
                <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                  Btw & netto
                </p>
                <Regel label="Omzet excl. btw" waarde={`€${p.omzetExclBtw.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}`} />
                <Regel label="Btw bedrag" waarde={`€${p.btw.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}`} />
                {p.kortingen > 0 && (
                  <Regel label="Kortingen gegeven" waarde={`€${p.kortingen.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}`} kleur="var(--sf-danger)" />
                )}
              </div>

              {(p.winst !== null || p.winstmarge !== null) && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: `${hex}08`, border: `1px solid ${hex}30` }}>
                  <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: hex }}>
                    Winst-indicatie
                  </p>
                  {p.winst !== null && (
                    <Regel label="Geschatte winst" waarde={`€${p.winst.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`} kleur={p.winst > 0 ? "var(--sf-success)" : "var(--sf-danger)"} />
                  )}
                  {p.winstmarge !== null && (
                    <Regel label="Winstmarge" waarde={`${(p.winstmarge * 100).toFixed(0)}%`} kleur={p.winstmarge > 0 ? "var(--sf-success)" : "var(--sf-danger)"} />
                  )}
                </div>
              )}

              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Lifetime-data over de hele beschikbare periode. Gebruik dit voor strategische
                beslissingen (assortiment, kostprijs, prijsstrategie) — voor live-trends zie
                de Producten-tabel.
              </p>
            </div>
          );
        })()}
      </DetailSheet>
    </div>
  );
}

function Regel({ label, waarde, kleur }: { label: string; waarde: string; kleur?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px]" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="font-mono text-[12px] font-medium tabular-nums" style={{ color: kleur ?? "var(--text)" }}>
        {waarde}
      </span>
    </div>
  );
}
