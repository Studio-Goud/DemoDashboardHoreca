"use client";

import { useState } from "react";
import type { WeerDag } from "@/lib/weer";
import { weerInfo } from "@/lib/weer";
import type { DagOmzet } from "@/lib/analytics";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import DetailSheet from "./sf/DetailSheet";

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
  const [actief, setActief] = useState<
    | { titel: string; type: "weer" | "temp"; bucket: Bucket; dagen: Array<{ datum: string; omzet: number; temp: number }> }
    | null
  >(null);
  if (weer.length === 0 || dagOmzet.length === 0) return null;

  const perWeer = groepeer(dagOmzet, weer);
  const perTemp = tempBuckets(dagOmzet, weer);

  const weerMap = new Map(weer.map((w) => [w.datum, w]));

  function bucketDagen(type: "weer" | "temp", b: Bucket): Array<{ datum: string; omzet: number; temp: number }> {
    const list: Array<{ datum: string; omzet: number; temp: number }> = [];
    for (const d of dagOmzet) {
      const w = weerMap.get(d.datum);
      if (!w) continue;
      if (type === "weer") {
        if (weerInfo(w.weerCode).categorie === b.categorie) {
          list.push({ datum: d.datum, omzet: d.omzet, temp: w.tempMax });
        }
      } else {
        const t = w.tempMax;
        const key = t < 5 ? "< 5°C" : t < 15 ? "5–15°C" : t < 22 ? "15–22°C" : t < 28 ? "22–28°C" : "> 28°C";
        if (key === b.categorie) {
          list.push({ datum: d.datum, omzet: d.omzet, temp: w.tempMax });
        }
      }
    }
    return list.sort((a, b) => b.omzet - a.omzet);
  }

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
                <button
                  type="button"
                  key={b.categorie}
                  onClick={() => setActief({ titel: `${b.emoji} ${b.categorie}`, type: "weer", bucket: b, dagen: bucketDagen("weer", b) })}
                  className="space-y-1 w-full text-left hover:bg-slate-50 transition-colors -mx-2 px-2 py-1 rounded cursor-pointer"
                >
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
                </button>
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
                <button
                  type="button"
                  key={b.categorie}
                  onClick={() => setActief({ titel: `${b.emoji} ${b.categorie}`, type: "temp", bucket: b, dagen: bucketDagen("temp", b) })}
                  className="space-y-1 w-full text-left hover:bg-slate-50 transition-colors -mx-2 px-2 py-1 rounded cursor-pointer"
                >
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
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief?.titel ?? ""}
        subtitel={
          actief
            ? `${actief.bucket.dagen} dagen · gem. ${fmt(actief.bucket.omzetGem)}/dag`
            : ""
        }
        hex={hex}
      >
        {actief && (() => {
          const afwijking = basisGem > 0 ? ((actief.bucket.omzetGem - basisGem) / basisGem) * 100 : 0;
          const top5 = actief.dagen.slice(0, 8);
          const bottom3 = actief.dagen.slice(-3).reverse();
          return (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
                <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                  Afwijking t.o.v. gemiddelde
                </p>
                <p
                  className="font-display text-[36px] font-semibold tabular-nums leading-none"
                  style={{ color: afwijking > 0 ? "var(--sf-success)" : afwijking < 0 ? "var(--sf-danger)" : "var(--muted)", letterSpacing: "-0.018em" }}
                >
                  {afwijking >= 0 ? "+" : ""}{afwijking.toFixed(0)}%
                </p>
                <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                  Gem. {fmt(actief.bucket.omzetGem)}/dag tijdens {actief.bucket.categorie} · alg. gem. {fmt(basisGem)}/dag
                </p>
              </div>

              <div>
                <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--muted)" }}>
                  Beste dagen
                </p>
                <div className="space-y-1.5">
                  {top5.map((d) => (
                    <div key={d.datum} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--sf-hairline)" }}>
                      <span className="text-[12px]" style={{ color: "var(--text)" }}>
                        {format(parseISO(d.datum), "EEEE d MMM yyyy", { locale: nl })}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--text)" }}>
                        {fmt(d.omzet)} · {d.temp.toFixed(0)}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {bottom3.length > 0 && actief.dagen.length > 8 && (
                <div>
                  <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--muted)" }}>
                    Slechtste dagen
                  </p>
                  <div className="space-y-1.5">
                    {bottom3.map((d) => (
                      <div key={d.datum} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--sf-hairline)" }}>
                        <span className="text-[12px]" style={{ color: "var(--text)" }}>
                          {format(parseISO(d.datum), "EEEE d MMM yyyy", { locale: nl })}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
                          {fmt(d.omzet)} · {d.temp.toFixed(0)}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {afwijking > 15
                  ? "Sterk bovengemiddelde omzet. Plan extra capaciteit als deze weersomstandigheden worden voorspeld."
                  : afwijking < -15
                  ? "Sterk ondergemiddelde omzet. Overweeg minder personeel of een binnen-aanbieding op deze dagen."
                  : "Omzet ligt rond het gemiddelde — geen sterke weer-correlatie voor deze categorie."}
              </p>
            </div>
          );
        })()}
      </DetailSheet>
    </div>
  );
}
