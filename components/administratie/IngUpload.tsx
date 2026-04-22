"use client";

import { useRef, useState } from "react";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
  onSuccess?: () => void;
}

export default function IngUpload({ bedrijf, hex, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<{ bericht: string; reviewNodig: number } | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function upload(bestand: File) {
    setBezig(true);
    setFout(null);
    setResultaat(null);

    const form = new FormData();
    form.append("bestand", bestand);

    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResultaat({ bericht: data.bericht, reviewNodig: data.reviewNodig });
      onSuccess?.();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setBezig(false);
    }
  }

  function onBestandGekozen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-700 mb-1">ING Bankafschrift</h3>
      <p className="text-[11px] text-slate-400 mb-3">
        Upload je ING Excel-export (.xlsx) of CSV. BTW wordt automatisch berekend per leverancier.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-slate-300 transition-colors"
      >
        {bezig ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: hex }} />
            <p className="text-sm text-slate-500">Verwerken…</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm text-slate-600 font-medium">Sleep bestand hier of klik</p>
            <p className="text-[11px] text-slate-400 mt-1">.xlsx of .csv van ING internetbankieren</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        onChange={onBestandGekozen}
        className="hidden"
      />

      {resultaat && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800 font-medium">✓ {resultaat.bericht}</p>
          {resultaat.reviewNodig > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              ⚠️ {resultaat.reviewNodig} transacties hebben handmatige BTW-controle nodig
            </p>
          )}
        </div>
      )}

      {fout && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{fout}</p>
        </div>
      )}
    </div>
  );
}
