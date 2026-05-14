"use client";

import { useEffect, useState } from "react";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  /** Totaal bruto-loon incl. vakantiegeld en verlof-uren (rapport.totaalEur). */
  totaalBrutoIncVakantie: number;
  hex: string;
}

/**
 * Footer-block onder de salaris-tabel: rekent de werkgeverslasten erbij
 * zodat owner direct de echte totale arbeidskost ziet. Trekt het percentage
 * uit bedrijfsinstellingen (default 27%).
 */
export default function ArbeidskostSamenvatting({ bedrijf, totaalBrutoIncVakantie, hex }: Props) {
  const [pct, setPct] = useState<number>(27);

  useEffect(() => {
    fetch(`/api/bedrijfsinstellingen/${bedrijf}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.werkgeverslastenPct !== undefined) setPct(j.werkgeverslastenPct); })
      .catch(() => null);
  }, [bedrijf]);

  // De bruto-component zonder vakantie-opslag = totaal / (1 + 8,33% + 8%)
  // Werkgeverslasten lopen typisch over BRUTO (niet over vakgeld), maar in
  // de praktijk wordt het ook vaak op het totaal-bruto-loon-incl gerekend.
  // We rekenen het over de pure bruto-component voor zuiverheid.
  const brutoZonderVakantie = totaalBrutoIncVakantie / 1.1633;
  const werkgeverslasten = brutoZonderVakantie * pct / 100;
  const arbeidskost = totaalBrutoIncVakantie + werkgeverslasten;

  function euro(n: number): string {
    return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="rounded-lg p-3 mt-3" style={{ background: "var(--bg)" }}>
      <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--muted)" }}>
        Werkelijke arbeidskost (incl. werkgeverslasten)
      </p>
      <div className="grid grid-cols-2 gap-1 text-[12px] tabular-nums">
        <span style={{ color: "var(--text-2)" }}>Totaal bruto + vakantie + verlof</span>
        <span className="text-right">{euro(totaalBrutoIncVakantie)}</span>
        <span style={{ color: "var(--text-2)" }}>+ {pct.toFixed(2)}% werkgeverslasten</span>
        <span className="text-right">+ {euro(werkgeverslasten)}</span>
        <span className="font-semibold pt-1 border-t border-slate-200" style={{ color: "var(--text)" }}>
          Totale arbeidskost
        </span>
        <span className="text-right font-semibold pt-1 border-t border-slate-200 tabular-nums" style={{ color: hex }}>
          {euro(arbeidskost)}
        </span>
      </div>
      <p className="text-[10px] mt-2" style={{ color: "var(--muted)" }}>
        Werkgeverslasten = pensioen + AOF + WW + ZVW + sociaal/opleidingsfonds.
        Pas het percentage aan via "Bedrijfsinstellingen" hieronder.
      </p>
    </div>
  );
}
