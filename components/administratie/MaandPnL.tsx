"use client";

import { useEffect, useState } from "react";
import type { MaandSamenvatting } from "@/lib/boekhouding";

const MAANDEN = ["", "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December"];

function euro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

interface MaandData {
  samenvatting: MaandSamenvatting;
  reviewItems: number;
}

export default function MaandPnL({ bedrijf, hex }: Props) {
  const nu = new Date();
  const [jaar, setJaar] = useState(nu.getFullYear());
  const [maand, setMaand] = useState(nu.getMonth() + 1);
  const [data, setData] = useState<MaandData | null>(null);
  const [laden, setLaden] = useState(false);

  async function laad() {
    setLaden(true);
    try {
      const res = await fetch(`/api/administratie/maand/${bedrijf}?jaar=${jaar}&maand=${maand}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => { laad(); }, [bedrijf, jaar, maand]);

  const s = data?.samenvatting;
  const statusKleur = s?.status === "winst" ? "#00A650" : s?.status === "verlies" ? "#CC0000" : "#F59E0B";
  const statusEmoji = s?.status === "winst" ? "📈" : s?.status === "verlies" ? "📉" : "➡️";
  const statusLabel = s?.status === "winst" ? "WINST" : s?.status === "verlies" ? "VERLIES" : "QUITTE";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">Maandoverzicht</h3>
        <div className="flex gap-2">
          <select
            value={maand}
            onChange={(e) => setMaand(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700"
          >
            {MAANDEN.slice(1).map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={jaar}
            onChange={(e) => setJaar(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700"
          >
            {[2024, 2025, 2026].map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
      </div>

      {laden && <p className="text-slate-400 text-sm">Laden…</p>}

      {s && !laden && (
        <>
          {/* Status banner */}
          <div
            className="rounded-xl p-4 mb-4 text-center"
            style={{ backgroundColor: statusKleur + "18", border: `2px solid ${statusKleur}` }}
          >
            <div className="text-3xl mb-1">{statusEmoji}</div>
            <div className="text-2xl font-bold" style={{ color: statusKleur }}>
              {statusLabel}
            </div>
            <div className="text-xl font-semibold text-slate-700 mt-1">
              {euro(s.nettoResultaat)}
            </div>
            <div className="text-xs text-slate-500 mt-1">netto resultaat {MAANDEN[s.maand]}</div>
          </div>

          {/* Kerncijfers grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Kaart label="Omzet (bruto)" waarde={s.omzetBruto} kleur={hex} />
            <Kaart label="Kosten totaal" waarde={s.kostenTotaal} kleur="#94A3B8" negatief />
            <Kaart label="Salarissen" waarde={s.salarissen} kleur="#94A3B8" negatief />
            <Kaart label="Contant inkomsten" waarde={s.contantInkomsten} kleur={hex} />
          </div>

          {/* DGA salaris */}
          {((s.dgaEchtRotterdams ?? 0) > 0 || (s.dgaMp5 ?? 0) > 0) && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">DGA Salaris</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Echt Rotterdams <span className="text-slate-400 text-xs">(100%)</span></span>
                <span className="font-medium text-slate-700">- {euro(s.dgaEchtRotterdams ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">MP5 <span className="text-slate-400 text-xs">(60%)</span></span>
                <span className="font-medium text-slate-700">- {euro(s.dgaMp5 ?? 0)}</span>
              </div>
              {(s.dgaEchtRotterdams ?? 0) > 0 && (s.dgaMp5 ?? 0) > 0 && (
                <div className="border-t border-slate-200 mt-2 pt-2 text-xs text-slate-400">
                  Verhouding: {Math.round(((s.dgaMp5 ?? 0) / (s.dgaEchtRotterdams ?? 1)) * 100)}% van ER
                  {Math.abs(Math.round(((s.dgaMp5 ?? 0) / (s.dgaEchtRotterdams ?? 1)) * 100) - 60) > 5 && (
                    <span className="text-amber-600 ml-2">⚠ afwijking van verwachte 60%</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BTW sectie */}
          <div className="bg-slate-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">BTW aangifte</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">BTW op omzet (te betalen)</span>
              <span className="font-medium text-red-600">{euro(s.omzetBtwBetaald)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-600">Voorbelasting 21%</span>
              <span className="font-medium text-green-600">- {euro(s.voorbelasting21)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-600">Voorbelasting 9%</span>
              <span className="font-medium text-green-600">- {euro(s.voorbelasting9)}</span>
            </div>
            <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-sm font-bold">
              <span>BTW saldo</span>
              <span style={{ color: s.btwTeVoldoen >= 0 ? "#CC0000" : "#00A650" }}>
                {s.btwTeVoldoen >= 0
                  ? `${euro(s.btwTeVoldoen)} betalen`
                  : `${euro(Math.abs(s.btwTeVoldoen))} ontvangen`}
              </span>
            </div>
          </div>

          {/* Kostenbreakdown per categorie */}
          {s.categorieBreakdown && Object.keys(s.categorieBreakdown).length > 0 && (
            <CategorieBreakdown
              breakdown={s.categorieBreakdown}
              omzet={s.omzetBruto}
              kostenFacturen={s.kostenFacturen ?? 0}
              kostenContant={s.kostenContant ?? 0}
            />
          )}

          {data.reviewItems > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ {data.reviewItems} transacties vereisen handmatige BTW-controle
            </div>
          )}
        </>
      )}

      {!s && !laden && (
        <p className="text-slate-400 text-sm text-center py-4">
          Upload een ING-bestand om het maandoverzicht te zien.
        </p>
      )}
    </div>
  );
}

function Kaart({
  label, waarde, kleur, negatief = false,
}: { label: string; waarde: number; kleur: string; negatief?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="font-semibold text-slate-800" style={{ color: negatief && waarde > 0 ? "#CC0000" : kleur }}>
        {negatief && waarde > 0 ? "- " : ""}{new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(waarde)}
      </p>
    </div>
  );
}

const CAT_META: Record<string, { label: string; emoji: string; groep: string }> = {
  levensmiddelen: { label: "Inkoop",           emoji: "🛒", groep: "inkoop"    },
  huur:           { label: "Huur",             emoji: "🏠", groep: "huur"      },
  telecom:        { label: "Telecom",          emoji: "📡", groep: "overhead"  },
  hosting:        { label: "Internet/Hosting", emoji: "🌐", groep: "overhead"  },
  software:       { label: "Software",         emoji: "💻", groep: "overhead"  },
  abonnement:     { label: "Abonnementen",     emoji: "🎵", groep: "overhead"  },
  marketing:      { label: "Marketing",        emoji: "📢", groep: "overhead"  },
  materiaal:      { label: "Materiaal",        emoji: "🔧", groep: "overhead"  },
  markthal:       { label: "Markthal",         emoji: "🏪", groep: "overhead"  },
  gemeentekosten: { label: "Gemeentekosten",   emoji: "🏛️", groep: "overhead"  },
  bankkosten:     { label: "Bankkosten",       emoji: "🏦", groep: "overhead"  },
  belasting:      { label: "Belasting",        emoji: "📋", groep: "overhead"  },
  "sociale-lasten": { label: "Sociale lasten", emoji: "👥", groep: "personeel" },
  pensioen:       { label: "Pensioen",         emoji: "🏦", groep: "personeel" },
  salaris:        { label: "Personeel",        emoji: "👤", groep: "personeel" },
};

function CategorieBreakdown({ breakdown, omzet, kostenFacturen, kostenContant }: { breakdown: Record<string, number>; omzet: number; kostenFacturen: number; kostenContant: number }) {
  const fmt = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

  const inkoop = Object.entries(breakdown)
    .filter(([cat]) => (CAT_META[cat]?.groep ?? "overhead") === "inkoop")
    .reduce((s, [, v]) => s + v, 0);

  const rows = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  const brutomarge = omzet > 0 ? omzet - inkoop : null;
  const margePercent = omzet > 0 ? Math.round(((omzet - inkoop) / omzet) * 100) : null;

  return (
    <div className="bg-slate-50 rounded-lg p-3 mb-3">
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Kostenbreakdown</p>

      {rows.map(([cat, bedrag]) => {
        const meta = CAT_META[cat] ?? { label: cat, emoji: "📌", groep: "overhead" };
        return (
          <div key={cat} className="flex justify-between text-sm py-0.5">
            <span className="text-slate-600">{meta.emoji} {meta.label}</span>
            <span className="font-medium text-slate-700">- {fmt(bedrag)}</span>
          </div>
        );
      })}
      {kostenFacturen > 0 && (
        <div className="flex justify-between text-sm py-0.5 border-t border-slate-200 mt-1 pt-1">
          <span className="text-amber-700">📧 Email facturen</span>
          <span className="font-medium text-amber-700">- {fmt(kostenFacturen)}</span>
        </div>
      )}
      {kostenContant > 0 && (
        <div className="flex justify-between text-sm py-0.5">
          <span className="text-slate-600">💵 Contante uitgaven</span>
          <span className="font-medium text-slate-700">- {fmt(kostenContant)}</span>
        </div>
      )}

      {brutomarge !== null && (
        <div className="border-t border-slate-200 mt-2 pt-2">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-slate-700">Bruto marge</span>
            <span style={{ color: brutomarge >= 0 ? "#00A650" : "#CC0000" }}>
              {fmt(brutomarge)} {margePercent !== null ? `(${margePercent}%)` : ""}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Omzet minus inkoop (excl. overige kosten)</p>
        </div>
      )}
    </div>
  );
}
