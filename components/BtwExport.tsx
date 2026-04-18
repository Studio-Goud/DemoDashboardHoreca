"use client";

import { useState } from "react";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

const MAANDEN = [
  "", "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

export default function BtwExport({ bedrijf, hex }: Props) {
  const nu = new Date();
  const [jaar, setJaar] = useState<number>(nu.getFullYear());
  const [maand, setMaand] = useState<number>(nu.getMonth() + 1);
  const [downloaden, setDownloaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const jaren: number[] = [];
  for (let j = 2023; j <= nu.getFullYear(); j++) jaren.push(j);

  async function downloadXlsx(heleJaar: boolean) {
    setDownloaden(true);
    setFout(null);
    try {
      const q = new URLSearchParams({ jaar: String(jaar) });
      if (!heleJaar) q.set("maand", String(maand));
      const res = await fetch(`/api/export/btw/${bedrijf}?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? "btw-export.xlsx";
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

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-700 mb-1">BTW-export</h3>
      <p className="text-[11px] text-slate-400 mb-3">
        Download een XLSX met omzet excl. BTW, BTW 9% en incl. BTW per dag.
        Handig voor de boekhouder. Nauwkeurige aanname: horeca-tarief 9%.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[11px] text-slate-500">
          Jaar
          <select
            value={jaar}
            onChange={(e) => setJaar(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-900 focus:outline-none"
          >
            {jaren.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[11px] text-slate-500">
          Maand
          <select
            value={maand}
            onChange={(e) => setMaand(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-900 focus:outline-none"
          >
            {MAANDEN.slice(1).map((m, i) => (
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => downloadXlsx(false)}
          disabled={downloaden}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: hex }}
        >
          {downloaden ? "Genereren…" : "Download maand"}
        </button>
        <button
          onClick={() => downloadXlsx(true)}
          disabled={downloaden}
          className="px-3 py-1.5 rounded-md text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Download heel jaar
        </button>
      </div>

      {fout && (
        <p className="text-xs text-red-600 mt-2">
          Fout bij exporteren: {fout}
        </p>
      )}
    </div>
  );
}
