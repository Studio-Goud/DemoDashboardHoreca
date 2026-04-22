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
    setSyncing(true);
    setFout(null);
    setBericht(null);
    // Max 2 dagen voor de handmatige knop (Vercel Hobby = 10s timeout)
    // De nachtelijke cron (06:00) haalt alles op vanaf Q2
    try {
      const res = await fetch(`/api/administratie/facturen/${bedrijf}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dagenTerug: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBericht(data.bericht);
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setSyncing(false);
    }
  }

  async function verwijder(id: string) {
    await fetch(`/api/administratie/facturen/${bedrijf}?jaar=${jaar}&id=${id}`, { method: "DELETE" });
    setFacturen((prev) => prev.filter((f) => f.id !== id));
  }

  const reviewFacturen = facturen.filter((f) => f.status === "review");

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Facturen (email)</h3>
          <p className="text-[11px] text-slate-400">Automatisch ingelezen via One.com · nachtelijke sync 06:00</p>
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
              </div>
              <div className="text-right ml-3 shrink-0">
                <div className="font-semibold text-slate-700">{euro(f.bedragInclBtw)}</div>
                <div className="text-[10px] text-slate-400">
                  BTW: {euro(f.btw21 + f.btw9)}
                </div>
              </div>
              <button
                onClick={() => verwijder(f.id)}
                className="ml-2 text-slate-300 hover:text-red-400 shrink-0"
                title="Verwijderen"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {facturen.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-sm">
          <span className="text-slate-500">{facturen.length} facturen</span>
          <span className="font-semibold text-slate-700">
            Totaal BTW: {euro(facturen.reduce((s, f) => s + f.btw21 + f.btw9, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
