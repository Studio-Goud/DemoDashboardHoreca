"use client";

import { useEffect, useState, useCallback } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

interface Tx {
  id: string;
  datum: string;
  omschrijving: string;
  bedrag: number;
  richting: "debit" | "credit";
  btw21: number;
  btw9: number;
  categorie: string;
  btwStatus: "auto" | "handmatig" | "review" | "nvt";
}

interface AiSuggestie {
  txId: string;
  categorie: string;
  tarief: 0 | 9 | 21;
  confidence: number;
  redenering: string;
}

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
  jaar: number;
}

const CATEGORIEEN = [
  { value: "levensmiddelen", label: "Inkoop levensmiddelen", tarief: 9 },
  { value: "huur",           label: "Huur",                  tarief: 21 },
  { value: "telecom",        label: "Telecom",               tarief: 21 },
  { value: "software",       label: "Software / abonnement", tarief: 21 },
  { value: "marketing",      label: "Marketing",             tarief: 21 },
  { value: "materiaal",      label: "Materiaal / inrichting",tarief: 21 },
  { value: "representatie",  label: "Representatie",         tarief: 21 },
  { value: "salaris",        label: "Salaris / personeel",   tarief: 0  },
  { value: "belasting",      label: "Belasting / loonheffing",tarief: 0 },
  { value: "pensioen",       label: "Pensioen",              tarief: 0  },
  { value: "sociale-lasten", label: "Sociale lasten (UWV)",  tarief: 0  },
  { value: "bankkosten",     label: "Bankkosten",            tarief: 0  },
  { value: "verzekering",    label: "Verzekering",           tarief: 0  },
  { value: "vergoeding",     label: "Vergoeding (OV etc.)",  tarief: 0  },
  { value: "omzet",          label: "Omzet / inkomsten",     tarief: 0  },
  { value: "overig",         label: "Overig (geen BTW)",     tarief: 0  },
] as const;

function berekenBtwPreview(bedrag: number, tarief: number): { btw21: number; btw9: number } {
  const rnd = (n: number) => Math.round(n * 100) / 100;
  if (tarief === 21) return { btw21: rnd(bedrag - bedrag / 1.21), btw9: 0 };
  if (tarief === 9)  return { btw21: 0, btw9: rnd(bedrag - bedrag / 1.09) };
  return { btw21: 0, btw9: 0 };
}

export default function ReviewPanel({ bedrijf, hex, jaar }: Props) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [laden, setLaden] = useState(true);
  const [keuzes, setKeuzes] = useState<Record<string, { categorie: string; tarief: number }>>({});
  const [bezig, setBezig] = useState<Record<string, boolean>>({});
  const [herbezig, setHerbezig] = useState(false);
  const [aiBezig, setAiBezig] = useState(false);
  const [aiSuggesties, setAiSuggesties] = useState<Record<string, AiSuggestie>>({});

  const laadReview = useCallback(async () => {
    setLaden(true);
    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}?jaar=${jaar}`);
      const data = await res.json();
      const review: Tx[] = (data.transacties ?? []).filter((t: Tx) => t.btwStatus === "review" && t.richting === "debit");
      setTxs(review);
    } finally {
      setLaden(false);
    }
  }, [bedrijf, jaar]);

  useEffect(() => { laadReview(); }, [laadReview]);

  function getKeuze(tx: Tx) {
    if (keuzes[tx.id]) return keuzes[tx.id];
    const def = CATEGORIEEN[0];
    return { categorie: def.value, tarief: def.tarief };
  }

  async function herclassificeer() {
    setHerbezig(true);
    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}?jaar=${jaar}`, { method: "PUT" });
      if (res.ok) await laadReview();
    } finally {
      setHerbezig(false);
    }
  }

  async function slaOp(tx: Tx) {
    const { categorie, tarief } = getKeuze(tx);
    const [jaar_, maand_] = tx.datum.split("-").map(Number);
    const { btw21, btw9 } = berekenBtwPreview(tx.bedrag, tarief);

    setBezig((b) => ({ ...b, [tx.id]: true }));
    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // omschrijving meesturen zodat de leer-laag een regel kan opslaan
        body: JSON.stringify({ id: tx.id, jaar: jaar_, maand: maand_, btw21, btw9, categorie, omschrijving: tx.omschrijving }),
      });
      if (res.ok) {
        setTxs((prev) => prev.filter((t) => t.id !== tx.id));
      }
    } finally {
      setBezig((b) => ({ ...b, [tx.id]: false }));
    }
  }

  /**
   * Roep de Boekhoud-Agent aan om alle openstaande transacties te
   * categoriseren. Hoge-vertrouwen suggesties worden auto-toegepast
   * door de backend; lagere komen terug als suggestie met "Accepteer".
   */
  async function aiCategoriseer() {
    setAiBezig(true);
    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}/ai-categoriseer?jaar=${jaar}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoToepassenAbove: 0.85 }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`AI-categorisatie mislukt: ${data.error ?? "onbekend"}`);
        return;
      }
      // Sla suggesties op per tx-id voor de UI
      const map: Record<string, AiSuggestie> = {};
      for (const s of (data.suggesties ?? []) as AiSuggestie[]) {
        map[s.txId] = s;
      }
      setAiSuggesties(map);
      // Auto-toegepaste verdwijnen uit de review-lijst — herlaad
      await laadReview();
      if (data.melding) alert(data.melding);
    } catch (e) {
      alert(`Netwerkfout: ${e instanceof Error ? e.message : "onbekend"}`);
    } finally {
      setAiBezig(false);
    }
  }

  /**
   * Eén-kliks accepteren van een AI-suggestie (zonder dropdown gebruik).
   */
  async function accepteerSuggestie(tx: Tx, sug: AiSuggestie) {
    setKeuzes((prev) => ({ ...prev, [tx.id]: { categorie: sug.categorie, tarief: sug.tarief } }));
    const [jaar_, maand_] = tx.datum.split("-").map(Number);
    const { btw21, btw9 } = berekenBtwPreview(tx.bedrag, sug.tarief);

    setBezig((b) => ({ ...b, [tx.id]: true }));
    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tx.id, jaar: jaar_, maand: maand_,
          btw21, btw9, categorie: sug.categorie,
          omschrijving: tx.omschrijving,
        }),
      });
      if (res.ok) {
        setTxs((prev) => prev.filter((t) => t.id !== tx.id));
      }
    } finally {
      setBezig((b) => ({ ...b, [tx.id]: false }));
    }
  }

  if (laden) return null;
  if (txs.length === 0) return null;

  return (
    <>
    <LoadingOverlay
      zichtbaar={aiBezig}
      titel="Boekhoud-Agent denkt mee"
      subtitel="Claude analyseert elke onbekende transactie en stelt categorie + BTW voor"
      accent="#BF5AF2"
      toonTimer
    />
    <div className="card border-l-4" style={{ borderLeftColor: "#f59e0b" }}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xl">⚠️</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-700">BTW-controle vereist</h3>
          <p className="text-xs text-slate-400">{txs.length} transacties zijn nog niet gecategoriseerd</p>
        </div>
        <button
          onClick={aiCategoriseer}
          disabled={aiBezig || herbezig || txs.length === 0}
          className="text-xs font-medium px-3 py-1.5 rounded text-white transition-opacity disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #BF5AF2 0%, #7B2DAA 100%)",
            boxShadow: "0 2px 10px -2px rgba(191,90,242,0.4)",
          }}
          title="Claude AI categoriseert alle openstaande transacties met redenering"
        >
          ✨ AI-categoriseer
        </button>
        <button
          onClick={herclassificeer}
          disabled={herbezig || aiBezig}
          className="text-xs px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          title="Herclassificeer automatisch met hardcoded + geleerde regels"
        >
          {herbezig ? "…" : "🔄 Herclassificeer"}
        </button>
      </div>

      <div className="space-y-3">
        {txs.map((tx) => {
          const keuze = getKeuze(tx);
          const preview = berekenBtwPreview(tx.bedrag, keuze.tarief);
          const sug = aiSuggesties[tx.id];
          const catLabel = sug ? (CATEGORIEEN.find((c) => c.value === sug.categorie)?.label ?? sug.categorie) : null;
          return (
            <div key={tx.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex flex-wrap items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{tx.omschrijving}</p>
                  <p className="text-xs text-slate-400">{tx.datum} · €{tx.bedrag.toFixed(2)}</p>
                </div>
              </div>

              {/* AI-suggestie strip — wordt getoond als AI er een had voor deze tx
                  maar confidence < drempel (anders was de tx al verdwenen). */}
              {sug && catLabel && (
                <div
                  className="rounded-md px-3 py-2 mb-2 flex flex-wrap items-center gap-2 text-xs"
                  style={{
                    background: "rgba(191,90,242,0.08)",
                    border: "1px solid rgba(191,90,242,0.30)",
                  }}
                >
                  <span style={{ color: "#7B2DAA", fontWeight: 600 }}>✨ AI:</span>
                  <span style={{ color: "#1D1D1F" }}>
                    {catLabel} · {sug.tarief}% BTW
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    ({Math.round(sug.confidence * 100)}% zeker — {sug.redenering})
                  </span>
                  <button
                    onClick={() => accepteerSuggestie(tx, sug)}
                    disabled={bezig[tx.id]}
                    className="ml-auto px-2.5 py-1 rounded-md text-[11px] font-medium text-white disabled:opacity-50"
                    style={{ background: "#BF5AF2" }}
                  >
                    Accepteer
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={keuze.categorie}
                  onChange={(e) => {
                    const cat = CATEGORIEEN.find((c) => c.value === e.target.value);
                    setKeuzes((prev) => ({ ...prev, [tx.id]: { categorie: e.target.value, tarief: cat?.tarief ?? 0 } }));
                  }}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white flex-1 min-w-[160px]"
                >
                  {CATEGORIEEN.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <select
                  value={keuze.tarief}
                  onChange={(e) => setKeuzes((prev) => ({ ...prev, [tx.id]: { ...keuze, tarief: Number(e.target.value) } }))}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white w-28"
                >
                  <option value={0}>Geen BTW</option>
                  <option value={9}>9% BTW</option>
                  <option value={21}>21% BTW</option>
                </select>

                {keuze.tarief > 0 && (
                  <span className="text-xs text-slate-500">
                    BTW: €{(preview.btw21 + preview.btw9).toFixed(2)}
                  </span>
                )}

                <button
                  onClick={() => slaOp(tx)}
                  disabled={bezig[tx.id]}
                  className="text-xs font-medium px-3 py-1.5 rounded text-white transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: hex }}
                >
                  {bezig[tx.id] ? "…" : "Opslaan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
