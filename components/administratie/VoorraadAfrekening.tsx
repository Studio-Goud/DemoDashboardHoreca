"use client";

import { useEffect, useState, useCallback } from "react";

type Slug = "bb" | "sl" | "kl";

interface AfrekeningRegel {
  productId: number;
  productNaam: string;
  eenheid: string;
  prijsPerEenheid: number;
  totaalAantal: number;
  totaalBedrag: number;
}

interface AfrekeningBedrijf {
  bedrijf: Slug;
  bedrijfNaam: string;
  regels: AfrekeningRegel[];
  totaal: number;
}

interface Afrekening {
  jaar: number;
  maand: number;
  perBedrijf: AfrekeningBedrijf[];
  totaalBedrag: number;
}

interface Props {
  hex: string;
  /** Filter alleen paren die dit bedrijf raken (bron SL of afnemer). */
  filterSlug?: Slug;
}

const BEDRIJF_HEX: Record<Slug, string> = {
  bb: "#0A84FF", sl: "#30B26F", kl: "#E07A1F",
};

const MAANDEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function huidigeJaarMaand() {
  const d = new Date();
  return { jaar: d.getFullYear(), maand: d.getMonth() + 1 };
}

export default function VoorraadAfrekening({ hex, filterSlug }: Props) {
  const [{ jaar, maand }, setPeriode] = useState(huidigeJaarMaand());
  const [data, setData] = useState<Afrekening | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await fetch(`/api/gedeelde-voorraad/afrekening/${jaar}/${maand}`, { cache: "no-store" });
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

  // Filter: alleen tonen als dit bedrijf SL is (bron) of in de afrekening voorkomt
  const perBedrijf = filterSlug && data
    ? (filterSlug === "sl"
        ? data.perBedrijf  // SL ziet alles wat ze factureren
        : data.perBedrijf.filter((b) => b.bedrijf === filterSlug))  // andere zien alleen eigen afname
    : data?.perBedrijf ?? [];

  const totaalBedrag = perBedrijf.reduce((s, b) => s + b.totaal, 0);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">Gedeelde voorraad</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            📦 Te factureren · {MAANDEN[maand - 1]} {jaar}
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

      {!laden && !fout && perBedrijf.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Niets te factureren deze maand. Producten zonder prijs worden overgeslagen —
          owner moet eerst de prijs zetten in Voorraad → Beheer producten.
        </p>
      )}

      {!laden && !fout && perBedrijf.length > 0 && (
        <>
          <div className="space-y-2.5">
            {perBedrijf.map((b) => {
              const slKleur = BEDRIJF_HEX.sl;
              const naarKleur = BEDRIJF_HEX[b.bedrijf];
              return (
                <details
                  key={b.bedrijf}
                  className="rounded-lg border border-slate-200 bg-white"
                >
                  <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: `${slKleur}1A`, color: slKleur }}
                      >
                        Saté Lounge
                      </span>
                      <span className="text-slate-400">→</span>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: `${naarKleur}1A`, color: naarKleur }}
                      >
                        {b.bedrijfNaam}
                      </span>
                      <span className="text-[11px] text-slate-400">· {b.regels.length} producten</span>
                    </div>
                    <span
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: slKleur }}
                    >
                      {fmt(b.totaal)}
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 px-3 py-2">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-slate-400 text-[10px] uppercase tracking-wide">
                          <th className="py-1 font-medium">Product</th>
                          <th className="py-1 font-medium text-right">Aantal</th>
                          <th className="py-1 font-medium text-right">Prijs</th>
                          <th className="py-1 font-medium text-right">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.regels.map((r) => (
                          <tr key={r.productId} className="border-t border-slate-50">
                            <td className="py-1.5">
                              {r.productNaam} <span className="text-slate-400 text-[10px]">({r.eenheid})</span>
                            </td>
                            <td className="py-1.5 text-right tabular-nums">{r.totaalAantal}</td>
                            <td className="py-1.5 text-right tabular-nums">{fmt(r.prijsPerEenheid)}</td>
                            <td className="py-1.5 text-right tabular-nums font-medium">{fmt(r.totaalBedrag)}</td>
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
              {filterSlug === "sl" ? "Totaal door te factureren" : "Totaal te ontvangen factuur"}
            </span>
            <span className="text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmt(totaalBedrag)}
            </span>
          </div>
        </>
      )}

      <p className="mt-3 text-[10px]" style={{ color: "var(--muted)" }}>
        Saté Lounge factureert de gedeelde-voorraad-afname aan de andere vestigingen.
        Producten zonder prijs worden niet meegerekend.
      </p>
    </div>
  );
}
