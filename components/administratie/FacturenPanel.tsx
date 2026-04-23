"use client";

import { useEffect, useState } from "react";
import type { Factuur } from "@/lib/factuur-ai";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
  jaar: number;
}

function euro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

export default function FacturenPanel({ bedrijf, hex, jaar }: Props) {
  const [facturen, setFacturen] = useState<Factuur[]>([]);
  const [laden, setLaden] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bericht, setBericht] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function laad() {
    setLaden(true);
    try {
      const res = await fetch(`/api/administratie/facturen/${bedrijf}?jaar=${jaar}`);
      if (res.ok) {
        const data = await res.json();
        setFacturen(data.facturen ?? []);
      }
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => { laad(); }, [bedrijf, jaar]);

  async function syncEmail() {
    // De echte sync loopt via GitHub Actions (dagelijks 07:00).
    // Deze knop herlaadt gewoon de meest recente data uit KV.
    setSyncing(true);
    setFout(null);
    setBericht(null);
    try {
      await laad();
      setBericht("Facturen herladen vanuit database.");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setSyncing(false);
    }
  }

  async function verwijder(id: string, leverancier: string) {
    if (!confirm(`Factuur van ${leverancier} verwijderen?`)) return;
    await fetch(`/api/administratie/facturen/${bedrijf}?jaar=${jaar}&id=${id}`, { method: "DELETE" });
    setFacturen((prev) => prev.filter((f) => f.id !== id));
  }

  const reviewFacturen = facturen.filter((f) => f.status === "review");

  // Groepeer per maand voor diagnose
  const perMaand = facturen.reduce<Record<string, { count: number; totaal: number }>>((acc, f) => {
    const maand = f.datum.slice(0, 7); // "2026-04"
    if (!acc[maand]) acc[maand] = { count: 0, totaal: 0 };
    acc[maand].count++;
    acc[maand].totaal += f.bedragInclBtw;
    return acc;
  }, {});
  const maandKeys = Object.keys(perMaand).sort();
  const totalBedrag = facturen.reduce((s, f) => s + f.bedragInclBtw, 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Facturen (email)</h3>
          <p className="text-[11px] text-slate-400">Dagelijkse sync via GitHub Actions · 07:00 NL</p>
        </div>
        <button
          onClick={syncEmail}
          disabled={syncing}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50 flex items-center gap-1.5"
          style={{ backgroundColor: hex }}
        >
          {syncing ? (
            <>
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
              Syncing…
            </>
          ) : "Sync email"}
        </button>
      </div>

      {bericht && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-800 mb-3">
          ✓ {bericht}
        </div>
      )}
      {fout && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700 mb-3">
          {fout}
        </div>
      )}

      {reviewFacturen.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 mb-3">
          ⚠️ {reviewFacturen.length} facturen vereisen controle (AI was onzeker)
        </div>
      )}

      {/* Maand-verdeling diagnose */}
      {maandKeys.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Verdeling per maand</p>
          {maandKeys.map((m) => {
            const { count, totaal } = perMaand[m];
            return (
              <div key={m} className="flex justify-between text-sm py-0.5">
                <span className="text-slate-600">{m} <span className="text-slate-400 text-xs">({count}x)</span></span>
                <span className={`font-medium ${totaal > 20000 ? "text-red-600" : "text-slate-700"}`}>
                  {euro(totaal)}
                </span>
              </div>
            );
          })}
          <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-sm font-bold">
            <span className="text-slate-700">Totaal {jaar}</span>
            <span className="text-slate-800">{euro(totalBedrag)}</span>
          </div>
        </div>
      )}

      {laden ? (
        <p className="text-slate-400 text-sm">Laden…</p>
      ) : facturen.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">
          Nog geen facturen gesynchroniseerd.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {facturen.map((f) => (
            <div
              key={f.id}
              className={`flex items-start justify-between p-2.5 rounded-lg text-sm ${
                f.status === "review" ? "bg-amber-50 border border-amber-100" : "bg-slate-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 truncate">{f.leverancier}</span>
                  {f.status === "review" && (
                    <span className="text-[10px] bg-amber-200 text-amber-800 px-1 rounded">review</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {f.datum} · {f.factuurnummer} · {f.btwTarief} BTW
                </div>
                {f.status === "review" && f.reviewReden && (
                  <div className="text-[10px] text-amber-700 mt-0.5">
                    ⚠ {f.reviewReden}
                  </div>
                )}
              </div>
              <div className="text-right ml-3 shrink-0">
                <div className="font-semibold text-slate-700">{euro(f.bedragInclBtw)}</div>
                <div className="text-[10px] text-slate-400">
                  BTW: {euro(f.btw21 + f.btw9)}
                </div>
              </div>
              <button
                onClick={() => verwijder(f.id, f.leverancier)}
                className="ml-2 px-2 py-1 text-xs text-red-400 hover:text-white hover:bg-red-400 rounded transition-colors shrink-0"
                title="Verwijderen"
              >
                Verwijder
              </button>
            </div>
          ))}
        </div>
      )}

      {facturen.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">{facturen.length} facturen</span>
            <span className="font-semibold text-slate-700">{euro(totalBedrag)}</span>
          </div>
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Waarvan BTW</span>
            <span>{euro(facturen.reduce((s, f) => s + f.btw21 + f.btw9, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
