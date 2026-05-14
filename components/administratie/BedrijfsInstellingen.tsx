"use client";

import { useEffect, useState, useCallback } from "react";
import { useRol } from "@/lib/useRol";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

/**
 * Card voor owner-only bedrijfsinstellingen. Toont (en bij owner: laat
 * wijzigen) het werkgeverslasten-percentage dat over bruto-loon wordt
 * gerekend. Default 27% (horeca-CAO typisch — zie loonjournaal).
 */
export default function BedrijfsInstellingen({ bedrijf, hex }: Props) {
  const { rol } = useRol();
  const [pct, setPct] = useState<number | null>(null);
  const [edit, setEdit] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState(false);

  const laad = useCallback(async () => {
    try {
      const res = await fetch(`/api/bedrijfsinstellingen/${bedrijf}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setPct(j.werkgeverslastenPct);
      setEdit(String(j.werkgeverslastenPct));
    } catch { /* stil */ }
  }, [bedrijf]);

  useEffect(() => { laad(); }, [laad]);

  async function opslaan() {
    if (rol !== "owner") return;
    const num = Number(edit.replace(",", "."));
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      setFout("Geef een getal tussen 0 en 100");
      return;
    }
    setBezig(true);
    setFout(null);
    setKlaar(false);
    try {
      const res = await fetch(`/api/bedrijfsinstellingen/${bedrijf}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ werkgeverslastenPct: num }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setPct(num);
      setKlaar(true);
      setTimeout(() => setKlaar(false), 2000);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  if (pct === null) return null; // nog aan het laden

  // Voorbeeldberekening voor uitleg
  const voorbeeldUurloon = 14.75;
  const allIn = voorbeeldUurloon * (1 + 0.0833 + 0.08 + pct / 100);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">Bedrijfsinstellingen</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            ⚙️ Werkgeverslasten-opslag
          </h3>
        </div>
        {klaar && (
          <span className="text-[11px] font-medium" style={{ color: "#30B26F" }}>✓ Opgeslagen</span>
        )}
      </div>

      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Opslag bovenop het bruto-uurloon: pensioen, AOF, WW, ZVW, opleidingsfonds
        en sociaal fonds bij elkaar. Default {27}% past bij de Nederlandse
        horeca-CAO; check je loonjournaal en verfijn als nodig.
      </p>

      {rol === "owner" ? (
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold block mb-1" style={{ color: "var(--muted)" }}>
              Percentage
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={edit}
                onChange={(e) => setEdit(e.target.value)}
                className="text-sm border border-slate-200 rounded px-2 py-1.5 w-24 tabular-nums"
              />
              <span className="text-sm" style={{ color: "var(--muted)" }}>%</span>
            </div>
          </div>
          <button
            onClick={opslaan}
            disabled={bezig || Number(edit) === pct}
            className="text-xs font-medium px-3 py-2 rounded text-white disabled:opacity-50"
            style={{ background: hex }}
          >
            {bezig ? "Bezig…" : "Opslaan"}
          </button>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {pct.toFixed(2)}%
          </span>
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>(alleen owner kan wijzigen)</span>
        </div>
      )}

      {fout && <p className="text-[12px] mt-2" style={{ color: "#E5484D" }}>{fout}</p>}

      <div className="mt-3 pt-3 border-t border-slate-100 text-[12px]" style={{ color: "var(--text-2)" }}>
        <p className="mb-1 font-medium">Voorbeeld bij €{voorbeeldUurloon.toFixed(2)} bruto uurloon</p>
        <div className="grid grid-cols-2 gap-1 tabular-nums">
          <span>+ 8,33% vakantiegeld</span>
          <span className="text-right">+ €{(voorbeeldUurloon * 0.0833).toFixed(2)}</span>
          <span>+ 8,00% verlof-uren</span>
          <span className="text-right">+ €{(voorbeeldUurloon * 0.08).toFixed(2)}</span>
          <span>+ {pct.toFixed(2)}% werkgeverslasten</span>
          <span className="text-right">+ €{(voorbeeldUurloon * pct / 100).toFixed(2)}</span>
          <span className="font-semibold pt-1 border-t border-slate-100">All-in arbeidskost</span>
          <span className="text-right font-semibold pt-1 border-t border-slate-100">€{allIn.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
