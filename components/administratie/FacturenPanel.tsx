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

function FactuurRij({
  f, bedrijf, jaar, hex, onUpdate, onVerwijder,
}: {
  f: Factuur; bedrijf: string; jaar: number; hex: string;
  onUpdate: (updated: Factuur) => void;
  onVerwijder: (id: string) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [datum, setDatum] = useState(f.datum);
  const [bedrag, setBedrag] = useState(String(f.bedragInclBtw));
  const [btw21, setBtw21] = useState(String(f.btw21));
  const [btw9, setBtw9] = useState(String(f.btw9));
  const [leverancier, setLeverancier] = useState(f.leverancier);
  const [bezig, setBezig] = useState(false);

  async function goedkeuren() {
    setBezig(true);
    const body = {
      id: f.id, jaar,
      datum,
      bedragInclBtw: parseFloat(bedrag) || 0,
      bedragExclBtw: (parseFloat(bedrag) || 0) - (parseFloat(btw21) || 0) - (parseFloat(btw9) || 0),
      btw21: parseFloat(btw21) || 0,
      btw9: parseFloat(btw9) || 0,
      leverancier,
      goedkeuren: true,
    };
    const res = await fetch(`/api/administratie/facturen/${bedrijf}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onUpdate({ ...f, ...body, status: "verwerkt" });
      setEdit(false);
    }
    setBezig(false);
  }

  const isReview = f.status === "review";

  return (
    <div className={`rounded-lg text-sm ${isReview ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
      {/* Hoofdrij */}
      <div className="flex items-start justify-between p-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800 truncate">{f.leverancier}</span>
            {isReview && <span className="text-[10px] bg-amber-200 text-amber-800 px-1 rounded shrink-0">review</span>}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {f.datum} · {f.factuurnummer} · {f.btwTarief} BTW
          </div>
          {isReview && f.reviewReden && (
            <div className="text-[10px] text-amber-700 mt-0.5">⚠ {f.reviewReden}</div>
          )}
        </div>
        <div className="text-right ml-3 shrink-0">
          <div className="font-semibold text-slate-700">{euro(f.bedragInclBtw)}</div>
          <div className="text-[10px] text-slate-400">BTW: {euro(f.btw21 + f.btw9)}</div>
        </div>
        <div className="ml-2 flex flex-col gap-1 shrink-0">
          {isReview && (
            <button
              onClick={() => setEdit((v) => !v)}
              className="px-2 py-1 text-xs text-amber-700 border border-amber-300 hover:bg-amber-100 rounded transition-colors"
            >
              {edit ? "Sluiten" : "Beoordeel"}
            </button>
          )}
          <button
            onClick={() => onVerwijder(f.id)}
            className="px-2 py-1 text-xs text-red-400 hover:text-white hover:bg-red-400 rounded transition-colors"
          >
            Verwijder
          </button>
        </div>
      </div>

      {/* Bewerkpaneel */}
      {edit && (
        <div className="border-t border-amber-200 px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase">Leverancier</span>
              <input
                value={leverancier}
                onChange={(e) => setLeverancier(e.target.value)}
                className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase">Factuurdatum</span>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase">Bedrag incl. BTW (€)</span>
              <input
                type="number"
                step="0.01"
                value={bedrag}
                onChange={(e) => setBedrag(e.target.value)}
                className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-1">
              <label className="block">
                <span className="text-[10px] text-slate-500 uppercase">BTW 21% (€)</span>
                <input
                  type="number"
                  step="0.01"
                  value={btw21}
                  onChange={(e) => setBtw21(e.target.value)}
                  className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-slate-500 uppercase">BTW 9% (€)</span>
                <input
                  type="number"
                  step="0.01"
                  value={btw9}
                  onChange={(e) => setBtw9(e.target.value)}
                  className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-xs"
                />
              </label>
            </div>
          </div>
          <button
            onClick={goedkeuren}
            disabled={bezig}
            className="w-full py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: hex }}
          >
            {bezig ? "Opslaan…" : "✓ Goedkeuren & opslaan"}
          </button>
        </div>
      )}
    </div>
  );
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
    try {
      await laad();
      setBericht("Facturen herladen vanuit database.");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setSyncing(false);
    }
  }

  function handleUpdate(updated: Factuur) {
    setFacturen((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }

  async function verwijder(id: string) {
    const f = facturen.find((x) => x.id === id);
    if (!confirm(`Factuur van ${f?.leverancier ?? id} verwijderen?`)) return;
    await fetch(`/api/administratie/facturen/${bedrijf}?jaar=${jaar}&id=${id}`, { method: "DELETE" });
    setFacturen((prev) => prev.filter((f) => f.id !== id));
  }

  const reviewFacturen = facturen.filter((f) => f.status === "review");
  const verwerktFacturen = facturen.filter((f) => f.status !== "review");

  const perMaand = facturen.reduce<Record<string, { count: number; totaal: number }>>((acc, f) => {
    const maand = f.datum.slice(0, 7);
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
            <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />Syncing…</>
          ) : "Sync email"}
        </button>
      </div>

      {bericht && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-800 mb-3">✓ {bericht}</div>
      )}
      {fout && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700 mb-3">{fout}</div>
      )}

      {/* Review sectie — altijd bovenaan */}
      {reviewFacturen.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
            ⚠ {reviewFacturen.length} facturen vereisen beoordeling
          </p>
          <div className="space-y-2">
            {reviewFacturen.map((f) => (
              <FactuurRij
                key={f.id} f={f} bedrijf={bedrijf} jaar={jaar} hex={hex}
                onUpdate={handleUpdate} onVerwijder={verwijder}
              />
            ))}
          </div>
        </div>
      )}

      {/* Maand-verdeling */}
      {maandKeys.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Verdeling per maand</p>
          {maandKeys.map((m) => {
            const { count, totaal } = perMaand[m];
            return (
              <div key={m} className="flex justify-between text-sm py-0.5">
                <span className="text-slate-600">{m} <span className="text-slate-400 text-xs">({count}x)</span></span>
                <span className={`font-medium ${totaal > 20000 ? "text-red-600" : "text-slate-700"}`}>{euro(totaal)}</span>
              </div>
            );
          })}
          <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-sm font-bold">
            <span className="text-slate-700">Totaal {jaar}</span>
            <span className="text-slate-800">{euro(totalBedrag)}</span>
          </div>
        </div>
      )}

      {/* Verwerkte facturen */}
      {laden ? (
        <p className="text-slate-400 text-sm">Laden…</p>
      ) : facturen.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">Nog geen facturen gesynchroniseerd.</p>
      ) : verwerktFacturen.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {verwerktFacturen.map((f) => (
            <FactuurRij
              key={f.id} f={f} bedrijf={bedrijf} jaar={jaar} hex={hex}
              onUpdate={handleUpdate} onVerwijder={verwijder}
            />
          ))}
        </div>
      ) : null}

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
