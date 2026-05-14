"use client";

import { useEffect, useState } from "react";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  omzet: number;
  brutoSalaris: number;
  hex: string;
}

/**
 * Toont loonkost-ratio = totale arbeidskost / omzet. All-in arbeidskost =
 * bruto salaris × (1 + 8,33% vakgeld + 8% verlof + werkgeverslasten-%).
 * Werkgeverslasten-% komt uit bedrijfsinstellingen. Industry-benchmark
 * horeca: ~30%; daarboven kleurt het oranje.
 */
export default function LoonkostRatio({ bedrijf, omzet, brutoSalaris, hex }: Props) {
  const [werkgeverslastenPct, setPct] = useState<number>(27);

  useEffect(() => {
    fetch(`/api/bedrijfsinstellingen/${bedrijf}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.werkgeverslastenPct !== undefined) setPct(j.werkgeverslastenPct); })
      .catch(() => null);
  }, [bedrijf]);

  const opslag = 1 + 0.0833 + 0.08 + werkgeverslastenPct / 100;
  const allInArbeidskost = brutoSalaris * opslag;
  const ratio = allInArbeidskost / omzet;
  const ratioPct = ratio * 100;

  // Kleurcoderen tegen benchmark 30%
  const kleur = ratioPct < 28 ? "#30B26F"
              : ratioPct < 32 ? hex
              : ratioPct < 38 ? "#E07A1F"
              : "#E5484D";

  function euro(n: number): string {
    return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div
      className="rounded-lg p-3 mb-3 border"
      style={{ borderColor: `${kleur}40`, background: `${kleur}08` }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
          Loonkost-ratio
        </p>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          benchmark horeca: 28-32%
        </span>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[28px] font-bold tabular-nums" style={{ color: kleur }}>
          {ratioPct.toFixed(1)}%
        </span>
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          van omzet
        </span>
      </div>
      <div className="text-[11px] mt-2 grid grid-cols-2 gap-1 tabular-nums" style={{ color: "var(--text-2)" }}>
        <span>Bruto salaris</span>
        <span className="text-right">{euro(brutoSalaris)}</span>
        <span>+ 8,33% vakantiegeld</span>
        <span className="text-right">+ {euro(brutoSalaris * 0.0833)}</span>
        <span>+ 8,00% verlof-uren</span>
        <span className="text-right">+ {euro(brutoSalaris * 0.08)}</span>
        <span>+ {werkgeverslastenPct.toFixed(2)}% werkgeverslasten</span>
        <span className="text-right">+ {euro(brutoSalaris * werkgeverslastenPct / 100)}</span>
        <span className="font-semibold pt-1 border-t border-slate-100">Totale arbeidskost</span>
        <span className="text-right font-semibold pt-1 border-t border-slate-100">{euro(allInArbeidskost)}</span>
      </div>
    </div>
  );
}
