"use client";

import { useEffect, useState, useCallback } from "react";

type Slug = "bb" | "sl" | "kl";

interface DgaPerMaand {
  maand: number;
  totaal: number;
  aantal: number;
  transacties: Array<{ datum: string; bedrag: number; omschrijving: string }>;
}

interface DgaPerCategorie {
  categorie: "dga-er" | "dga-mp5";
  label: string;
  totaal: number;
  aantal: number;
  laatste: { datum: string; bedrag: number; omschrijving: string } | null;
  perMaand: DgaPerMaand[];
}

interface DgaData {
  jaar: number;
  perDga: DgaPerCategorie[];
  perMaand: Array<{ maand: number; totaal: number }>;
  totaal: number;
}

interface EnergieData {
  jaar: number;
  perMaand: Array<{ maand: number; bedrag: number; aantal: number }>;
  perLeverancier: Array<{ leverancier: string; totaal: number; aantal: number }>;
  totaal: number;
  aantal: number;
  gemPerMaand: number;
}

interface Props {
  bedrijf: Slug;
  hex: string;
}

const MAANDEN_KORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtKort(n: number): string {
  return "€" + Math.round(n).toLocaleString("nl-NL");
}

export default function DgaEnergiePanel({ bedrijf, hex }: Props) {
  const huidigJaar = new Date().getFullYear();
  const [jaar, setJaar] = useState(huidigJaar);
  const [dga, setDga] = useState<DgaData | null>(null);
  const [energie, setEnergie] = useState<EnergieData | null>(null);
  const [laden, setLaden] = useState(true);
  const [opengeklapt, setOpengeklapt] = useState<Set<string>>(new Set());

  function toggleOpenklap(cat: string) {
    setOpengeklapt((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat); else n.add(cat);
      return n;
    });
  }

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const res = await fetch(`/api/dga-energie/${bedrijf}?jaar=${jaar}`, { cache: "no-store" });
      if (!res.ok) {
        setDga(null);
        setEnergie(null);
        return;
      }
      const j = await res.json();
      setDga(j.dga);
      setEnergie(j.energie);
    } finally {
      setLaden(false);
    }
  }, [bedrijf, jaar]);

  useEffect(() => { laad(); }, [laad]);

  // Herlaad zodra het venster weer focus krijgt (bv. na PWA-tab-switch of na
  // het wijzigen van een contant-categorie in de Administratie-tab). Anders
  // toont de DGA-kaart stale data tot een full page-refresh.
  useEffect(() => {
    function refresh() { laad(); }
    function onVisibility() { if (!document.hidden) laad(); }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("contant-gewijzigd", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("contant-gewijzigd", refresh);
    };
  }, [laad]);

  if (laden && !dga) {
    return (
      <div className="card">
        <div className="h-24 bg-slate-50 rounded animate-pulse" />
      </div>
    );
  }

  if (!dga || !energie) return null;

  const maxMaand = Math.max(...energie.perMaand.map((m) => m.bedrag), 1);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">Privé & vaste lasten</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            💼 DGA &amp; ⚡ Energie · {jaar}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setJaar((j) => j - 1)}
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >‹</button>
          <span className="text-xs tabular-nums w-12 text-center" style={{ color: "var(--muted)" }}>{jaar}</span>
          <button
            onClick={() => setJaar((j) => j + 1)}
            className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >›</button>
        </div>
      </div>

      {/* DGA-onttrekkingen */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
          💼 DGA-onttrekkingen YTD
        </p>
        {dga.perDga.map((d) => {
          const isOpen = opengeklapt.has(d.categorie);
          return (
            <div
              key={d.categorie}
              className="rounded-lg border border-slate-200 bg-white"
            >
              <button
                onClick={() => toggleOpenklap(d.categorie)}
                className="w-full p-3 flex items-center justify-between gap-3 flex-wrap text-left"
                aria-expanded={isOpen}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                    <span
                      className="text-slate-400 text-[10px] transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                    >▶</span>
                    {d.label}
                  </p>
                  {d.laatste ? (
                    <p className="text-[11px] text-slate-400 ml-3.5">
                      Laatste: {d.laatste.datum} · {fmt(d.laatste.bedrag)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 ml-3.5">Nog geen onttrekkingen dit jaar</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[18px] font-semibold tabular-nums" style={{ color: hex }}>
                    {fmt(d.totaal)}
                  </p>
                  <p className="text-[10px] text-slate-400">{d.aantal} {d.aantal === 1 ? "transactie" : "transacties"}</p>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-3 py-2 space-y-0.5 bg-slate-50/50 rounded-b-lg">
                  {d.perMaand.map((m) => (
                    <div key={m.maand} className="text-[12px]">
                      <div className="flex items-baseline justify-between gap-2 py-1">
                        <span
                          className="capitalize w-14 shrink-0"
                          style={{ color: m.totaal > 0 ? "var(--text)" : "var(--muted)" }}
                        >
                          {MAANDEN_KORT[m.maand - 1]}
                        </span>
                        <span
                          className="tabular-nums flex-1 text-right"
                          style={{
                            color: m.totaal > 0 ? "var(--text)" : "var(--muted)",
                            opacity: m.totaal > 0 ? 1 : 0.5,
                          }}
                        >
                          {m.totaal > 0 ? fmt(m.totaal) : "—"}
                        </span>
                        <span className="text-[10px] text-slate-400 w-6 text-right shrink-0">
                          {m.aantal > 0 ? `${m.aantal}×` : ""}
                        </span>
                      </div>
                      {m.transacties.length > 0 && (
                        <div className="ml-14 pl-2 border-l border-slate-200 space-y-0.5 mb-1">
                          {m.transacties.map((tx, i) => (
                            <div key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
                              <span className="text-slate-400 truncate">
                                {tx.datum.slice(8, 10)}/{tx.datum.slice(5, 7)} · {tx.omschrijving}
                              </span>
                              <span className="tabular-nums text-slate-500 shrink-0">{fmt(tx.bedrag)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-slate-100">
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>Totaal DGA opgenomen {jaar}</span>
          <span className="text-[16px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {fmt(dga.totaal)}
          </span>
        </div>
      </div>

      {/* Energie-kosten */}
      <div className="space-y-2 mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
            ⚡ Energie YTD
          </p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>
            gem. {fmtKort(energie.gemPerMaand)}/maand · {energie.aantal} transacties
          </p>
        </div>

        {energie.totaal === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Nog geen energie-transacties gecategoriseerd. Patronen herkennen Eneco, Vattenfall,
            Greenchoice, Essent, Evides, Enexis, Stedin en Liander automatisch bij volgende upload.
          </p>
        ) : (
          <>
            {/* Mini-bar-chart per maand */}
            <div className="flex items-end gap-1 h-16 mb-1">
              {energie.perMaand.map((m) => (
                <div key={m.maand} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      background: m.bedrag > 0 ? hex : "var(--bg-elev)",
                      height: `${Math.max(2, (m.bedrag / maxMaand) * 100)}%`,
                      opacity: m.bedrag > 0 ? 0.85 : 0.3,
                    }}
                    title={m.bedrag > 0 ? `${MAANDEN_KORT[m.maand - 1]}: ${fmt(m.bedrag)}` : ""}
                  />
                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>
                    {MAANDEN_KORT[m.maand - 1]}
                  </span>
                </div>
              ))}
            </div>

            {/* Per leverancier top 5 */}
            {energie.perLeverancier.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
                  Top leveranciers
                </p>
                <ul className="space-y-1">
                  {energie.perLeverancier.slice(0, 5).map((l) => (
                    <li key={l.leverancier} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span style={{ color: "var(--text)" }}>{l.leverancier}</span>
                      <span className="text-slate-400 text-[10px]">{l.aantal}×</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>
                        {fmt(l.totaal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-slate-100">
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>Totaal energie {jaar}</span>
              <span className="text-[16px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                {fmt(energie.totaal)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
