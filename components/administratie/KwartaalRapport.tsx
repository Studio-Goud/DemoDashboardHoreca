"use client";

import { useState } from "react";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

const KWARTALEN = [1, 2, 3, 4] as const;

export default function KwartaalRapport({ bedrijf, hex }: Props) {
  const nu = new Date();
  const huidigKwartaal = Math.ceil((nu.getMonth() + 1) / 3) as 1 | 2 | 3 | 4;
  const [jaar, setJaar] = useState(nu.getFullYear());
  const [kwartaal, setKwartaal] = useState<1 | 2 | 3 | 4>(huidigKwartaal);
  const [downloaden, setDownloaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function download() {
    setDownloaden(true);
    setFout(null);
    try {
      const res = await fetch(
        `/api/administratie/kwartaal/${bedrijf}?jaar=${jaar}&kwartaal=${kwartaal}&format=xlsx`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `${bedrijf}_Q${kwartaal}_${jaar}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setDownloaden(false);
    }
  }

  const jaren = [2024, 2025, 2026, 2027];

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-700 mb-1">Kwartaalrapport downloaden</h3>
      <p className="text-[11px] text-slate-400 mb-4">
        Compleet overzicht: ING transacties, facturen, contant, BTW en P&L — direct klaar voor de accountant.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-[11px] text-slate-500">
          Jaar
          <select
            value={jaar}
            onChange={(e) => setJaar(Number(e.target.value))}
            className="mt-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
          >
            {jaren.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </label>

        <label className="flex flex-col text-[11px] text-slate-500">
          Kwartaal
          <select
            value={kwartaal}
            onChange={(e) => setKwartaal(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="mt-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
          >
            {KWARTALEN.map((k) => (
              <option key={k} value={k}>Q{k}</option>
            ))}
          </select>
        </label>

        <button
          onClick={download}
          disabled={downloaden}
          className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: hex }}
        >
          {downloaden ? (
            <>
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
              Genereren…
            </>
          ) : (
            <>📥 Download Q{kwartaal} {jaar}</>
          )}
        </button>
      </div>

      {fout && (
        <p className="text-xs text-red-600 mt-3">{fout}</p>
      )}

      <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-600">Het Excel bevat 4 tabbladen:</p>
        <p>📊 <strong>Samenvatting</strong> — P&L per maand + kwartaaltotaal + BTW aangifte</p>
        <p>🏦 <strong>ING Transacties</strong> — alle bankboekingen met BTW-categorie</p>
        <p>📄 <strong>Facturen</strong> — email-facturen geparseeerd door AI</p>
        <p>💵 <strong>Contant</strong> — handmatig ingevoerde contante transacties</p>
      </div>
    </div>
  );
}
