"use client";

import { useEffect, useState, useCallback } from "react";

interface InleenRegel {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  uren: number;
  uurloon: number;
  bedrag: number;
}

interface InleenPaar {
  vanSlug: string;
  vanNaam: string;
  naarSlug: string;
  naarNaam: string;
  regels: InleenRegel[];
  totaalUren: number;
  totaalBedrag: number;
}

interface Overzicht {
  jaar: number;
  maand: number;
  paren: InleenPaar[];
  totaalBedrag: number;
}

interface Props {
  hex: string;
  /** Optioneel: alleen paren tonen die DIT bedrijf raken (als uitlener of inlener). */
  filterSlug?: "bb" | "sl" | "kl";
}

const BEDRIJF_HEX: Record<string, string> = {
  bb: "#0A84FF", sl: "#30B26F", kl: "#E07A1F",
};

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function huidigeJaarMaand(): { jaar: number; maand: number } {
  const d = new Date();
  return { jaar: d.getFullYear(), maand: d.getMonth() + 1 };
}

const MAANDEN_NL = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

export default function InleenDoorberekening({ hex, filterSlug }: Props) {
  const [{ jaar, maand }, setPeriode] = useState(huidigeJaarMaand());
  const [data, setData] = useState<Overzicht | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await fetch(`/api/inleen/${jaar}/${maand}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setFout(e instanceof Error ? e.message : "onbekende fout");
    } finally {
      setLaden(false);
    }
  }, [jaar, maand]);

  useEffect(() => { laad(); }, [laad]);

  // Filter paren op vestiging-betrokkenheid
  const paren = filterSlug && data
    ? data.paren.filter((p) => p.vanSlug === filterSlug || p.naarSlug === filterSlug)
    : data?.paren ?? [];

  const totaalBedrag = paren.reduce((s, p) => s + p.totaalBedrag, 0);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">Tussen vestigingen</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            📨 Te factureren · {MAANDEN_NL[maand - 1]} {jaar}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const v = maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 };
              setPeriode(v);
            }}
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >
            ‹
          </button>
          <span className="text-xs tabular-nums w-20 text-center" style={{ color: "var(--muted)" }}>
            {String(maand).padStart(2, "0")}-{jaar}
          </span>
          <button
            onClick={() => {
              const v = maand === 12 ? { jaar: jaar + 1, maand: 1 } : { jaar, maand: maand + 1 };
              setPeriode(v);
            }}
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >
            ›
          </button>
        </div>
      </div>

      {laden && (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!laden && fout && (
        <p className="text-[12px]" style={{ color: "#E5484D" }}>Fout: {fout}</p>
      )}

      {!laden && !fout && paren.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Geen inleen-uren deze maand. Medewerkers werken alleen bij hun eigen vestiging
          {filterSlug && " of zijn nog niet aan een thuis-vestiging gekoppeld"}.
        </p>
      )}

      {!laden && !fout && paren.length > 0 && (
        <>
          <div className="space-y-2.5">
            {paren.map((p) => {
              const vanKleur = BEDRIJF_HEX[p.vanSlug] ?? hex;
              const naarKleur = BEDRIJF_HEX[p.naarSlug] ?? hex;
              return (
                <details
                  key={`${p.vanSlug}-${p.naarSlug}`}
                  className="rounded-lg border border-slate-200 bg-white"
                >
                  <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: `${vanKleur}1A`, color: vanKleur }}
                      >
                        {p.vanNaam}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: `${naarKleur}1A`, color: naarKleur }}
                      >
                        {p.naarNaam}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        · {p.totaalUren.toFixed(1)}u
                      </span>
                    </div>
                    <span
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: vanKleur }}
                    >
                      {fmt(p.totaalBedrag)}
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 px-3 py-2">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-slate-400 text-[10px] uppercase tracking-wide">
                          <th className="py-1 font-medium">Medewerker</th>
                          <th className="py-1 font-medium text-right">Uren</th>
                          <th className="py-1 font-medium text-right">Uurloon</th>
                          <th className="py-1 font-medium text-right">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.regels.map((r) => (
                          <tr key={r.medewerkerId} className="border-t border-slate-50">
                            <td className="py-1.5">{r.voornaam} {r.achternaam}</td>
                            <td className="py-1.5 text-right tabular-nums">{r.uren.toFixed(1)}u</td>
                            <td className="py-1.5 text-right tabular-nums">{fmt(r.uurloon)}</td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{fmt(r.bedrag)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              Totaal te factureren {filterSlug ? "(met deze vestiging betrokken)" : ""}
            </span>
            <span className="text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmt(totaalBedrag)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
