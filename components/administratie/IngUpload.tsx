"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

interface VerbindingStatus {
  verbonden: boolean;
  verbindingStatus: string;
  accounts: Array<{ id: string; iban: string; name: string }>;
  verbondenOp: string | null;
  verlooptOp: string | null;
  laatsteSync: string | null;
}

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
  onSuccess?: () => void;
}

export default function IngUpload({ bedrijf, hex, onSuccess }: Props) {
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<VerbindingStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bericht, setBericht] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  // Verwerk callback params (na ING OAuth2 redirect)
  useEffect(() => {
    const success = searchParams.get("gc_success");
    const error = searchParams.get("gc_error");
    if (success) setBericht("ING succesvol gekoppeld!");
    if (error) setFout(`Koppeling mislukt: ${decodeURIComponent(error)}`);
  }, [searchParams]);

  async function laadStatus() {
    const res = await fetch(`/api/administratie/ing-sync/${bedrijf}`);
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => { laadStatus(); }, [bedrijf]);

  async function syncNu() {
    setSyncing(true);
    setFout(null);
    setBericht(null);
    try {
      const res = await fetch(`/api/administratie/ing-sync/${bedrijf}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBericht(data.bericht);
      await laadStatus();
      onSuccess?.();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setSyncing(false);
    }
  }

  async function uploadBestand(bestand: File) {
    setUploading(true);
    setFout(null);
    setBericht(null);
    const form = new FormData();
    form.append("bestand", bestand);
    try {
      const res = await fetch(`/api/administratie/ing/${bedrijf}`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBericht(data.bericht);
      onSuccess?.();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setUploading(false);
    }
  }

  const verbonden = status?.verbonden;
  const verlooptBinnenkort = status?.verlooptOp &&
    new Date(status.verlooptOp).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">ING Bankafschrift</h3>
          <p className="text-[11px] text-slate-400">
            {verbonden ? "Automatische dagelijkse sync via GoCardless" : "Koppel ING voor automatische transacties"}
          </p>
        </div>
        {/* Status indicator */}
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
          verbonden
            ? "bg-green-100 text-green-700"
            : "bg-slate-100 text-slate-500"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${verbonden ? "bg-green-500" : "bg-slate-400"}`} />
          {verbonden ? "Gekoppeld" : "Niet gekoppeld"}
        </div>
      </div>

      {verbonden ? (
        <>
          {/* Account info */}
          <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-1">
            {status?.accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">{acc.name || "ING Rekening"}</span>
                <span className="text-slate-400 font-mono text-xs">{acc.iban}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-200 mt-1">
              <span>Laatste sync: {status?.laatsteSync
                ? new Date(status.laatsteSync).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })
                : "Nog niet"}</span>
              <span>Verloopt: {status?.verlooptOp
                ? new Date(status.verlooptOp).toLocaleDateString("nl-NL")
                : "?"}</span>
            </div>
          </div>

          {verlooptBinnenkort && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 mb-3">
              ⚠️ Koppeling verloopt binnenkort — opnieuw koppelen om automatische sync te behouden.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={syncNu}
              disabled={syncing}
              className="flex-1 px-3 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: hex }}
            >
              {syncing
                ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Syncing…</>
                : "↓ Sync nu"}
            </button>
            <a
              href={`/api/administratie/ing-connect/${bedrijf}`}
              className="px-3 py-2 rounded-md text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Opnieuw koppelen
            </a>
          </div>
        </>
      ) : (
        <>
          {/* Niet verbonden — koppelen + fallback upload */}
          <a
            href={`/api/administratie/ing-connect/${bedrijf}`}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium mb-4"
            style={{ backgroundColor: hex }}
          >
            <span className="text-lg">🏦</span>
            Verbind ING automatisch
          </a>

          <div className="relative flex items-center my-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="mx-3 text-xs text-slate-400">of handmatig</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadBestand(f); }}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-slate-300 transition-colors"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: hex }} />
                <p className="text-sm text-slate-500">Verwerken…</p>
              </div>
            ) : (
              <>
                <p className="text-2xl mb-1">📂</p>
                <p className="text-sm text-slate-600">Sleep ING export hier of klik</p>
                <p className="text-[10px] text-slate-400 mt-0.5">.xlsx of .csv</p>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.txt"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBestand(f); e.target.value = ""; }}
            className="hidden" />
        </>
      )}

      {bericht && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2.5 text-sm text-green-800">
          ✓ {bericht}
        </div>
      )}
      {fout && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm text-red-700">
          {fout}
        </div>
      )}

      <p className="text-[10px] text-slate-300 mt-3 text-center">
        Dagelijkse auto-sync om 06:00 · Powered by GoCardless Open Banking
      </p>
    </div>
  );
}
