"use client";

import type { WeerDag } from "@/lib/weer";
import { weerInfo } from "@/lib/weer";
import type { DagOmzet } from "@/lib/analytics";
import { parseISO } from "date-fns";

interface Props {
  dagOmzet: DagOmzet[];
  weer: WeerDag[];
  hex: string;
}

interface Bucket {
  categorie: string;
  emoji: string;
  dagen: number;
  omzetGem: number;
  omzetTotaal: number;
}

function groepeer(dagOmzet: DagOmzet[], weer: WeerDag[]): Bucket[] {
  const weerMap = new Map(weer.map((w) => [w.datum, w]));
  const map = new Map<string, { emoji: string; omzetten: number[] }>();
  for (const d of dagOmzet) {
    const w = weerMap.get(d.datum);
    if (!w) continue;
    const info = weerInfo(w.weerCode);
    const cur = map.get(info.categorie) ?? { emoji: info.emoji, omzetten: [] };
    cur.omzetten.push(d.omzet);
    map.set(info.categorie, cur);
  }
  return Array.from(map.entries())
    .map(([categorie, v]) => {
      const totaal = v.omzetten.reduce((s, x) => s + x, 0);
      return {
        categorie,
        emoji: v.emoji,
        dagen: v.omzetten.length,
        omzetGem: v.omzetten.length > 0 ? totaal / v.omzetten.length : 0,
        omzetTotaal: totaal,
      };
    })
    .sort((a, b) => b.omzetGem - a.omzetGem);
}

function tempBuckets(dagOmzet: DagOmzet[], weer: WeerDag[]): Bucket[] {
  const weerMap = new Map(weer.map((w) => [w.datum, w]));
  const buckets: Record<string, { omzetten: number[]; emoji: string }> = {
    "< 5°C": { omzetten: [], emoji: "🥶" },
    "5–15°C": { omzetten: [], emoji: "🧥" },
    "15–22°C": { omzetten: [], emoji: "🙂" },
    "22–28°C": { omzetten: [], emoji: "😎" },
    "> 28°C": { omzetten: [], emoji: "🥵" },
  };
  for (const d of dagOmzet) {
    const w = weerMap.get(d.datum);
    if (!w) continue;
    const t = w.tempMax;
    const key =
      t < 5 ? "< 5°C" : t < 15 ? "5–15°C" : t < 22 ? "15–22°C" : t < 28 ? "22–28°C" : "> 28°C";
    buckets[key].omzetten.push(d.omzet);
  }
  return Object.entries(buckets)
    .filter(([, v]) => v.omzetten.length > 0)
    .map(([categorie, v]) => {
      const totaal = v.omzetten.reduce((s, x) => s + x, 0);
      return {
        categorie,
        emoji: v.emoji,
        dagen: v.omzetten.length,
        omzetGem: v.omzetten.length > 0 ? totaal / v.omzetten.length : 0,
        omzetTotaal: totaal,
      };
    });
}

export default function WeerImpact({ dagOmzet, weer, hex }: Props) {
  if (weer.length === 0 || dagOmzet.length === 0) return null;

  const perWeer = groepeer(dagOmzet, weer);
  const perTemp = tempBuckets(dagOmzet, weer);

  const basisGem =
    dagOmzet.length > 0
      ? dagOmzet.reduce((s, d) => s + d.omzet, 0) / dagOmzet.length
      : 0;

  const fmt = (n: number) =>
    `€${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;

  const maxGem = Math.max(...perWeer.map((b) => b.omzetGem), basisGem);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-slate-700">Weer-impact op omzet</h3>
        <span className="text-[11px] text-slate-400">
          Rotterdam · bron Open-Meteo · {dagOmzet.length} dagen data
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Gem. dagomzet gekoppeld aan weer-categorie en max-temperatuur.
        Algemeen gemiddelde: {fmt(basisGem)}/dag.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">
            Per weer-categorie
          </p>
          <div className="space-y-1.5">
            {perWeer.map((b) => {
              const afwijking = basisGem > 0 ? ((b.omzetGem - basisGem) / basisGem) * 100 : 0;
              const pct = (b.omzetGem / maxGem) * 100;
              return (
                <div key={b.categorie} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span>{b.emoji}</span>
                      <span className="capitalize">{b.categorie}</span>
                      <span className="text-slate-400">({b.dagen}d)</span>
                    </span>
                    <span className="tabular-nums">
                      {fmt(b.omzetGem)}
                      <span
                        className={`ml-2 text-[10px] ${
                          afwijking >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {afwijking >= 0 ? "+" : ""}
                        {afwijking.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: hex, opacity: 0.75 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">
            Per max-temperatuur
          </p>
          <div className="space-y-1.5">
            {perTemp.map((b) => {
              const afwijking = basisGem > 0 ? ((b.omzetGem - basisGem) / basisGem) * 100 : 0;
              const pct = (b.omzetGem / maxGem) * 100;
              return (
                <div key={b.categorie} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span>{b.emoji}</span>
                      <span>{b.categorie}</span>
                      <span className="text-slate-400">({b.dagen}d)</span>
                    </span>
                    <span className="tabular-nums">
                      {fmt(b.omzetGem)}
                      <span
                        className={`ml-2 text-[10px] ${
                          afwijking >= 0 ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {afwijking >= 0 ? "+" : ""}
                        {afwijking.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: hex, opacity: 0.75 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
