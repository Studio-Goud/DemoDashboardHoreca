"use client";

/**
 * Dev-tooling: maak of reset een test-medewerker (PIN 1111) met alles
 * al ingevuld zodat owner het /m portaal kan testen. Owner-only — API
 * checkt rol; alleen owner krijgt success-response.
 */
import { useState } from "react";
import { Loader2, Check, FlaskConical, Copy, ExternalLink } from "lucide-react";

interface Props {
  hex: string;
}

interface Resultaat {
  email: string;
  pin: string;
  bericht: string;
  autoLogin: boolean;
}

export default function TestAccountSeed({ hex }: Props) {
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function seed() {
    setBezig(true);
    setFout(null);
    setResultaat(null);
    try {
      const res = await fetch("/api/admin/seed-test-medewerker", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Aanmaken mislukt");
      setResultaat({ email: j.email, pin: j.pin, bericht: j.bericht, autoLogin: !!j.autoLogin });
    } catch (e: unknown) {
      setFout(e instanceof Error ? e.message : "Aanmaken mislukt");
    } finally {
      setBezig(false);
    }
  }

  async function kopieer(tekst: string) {
    try { await navigator.clipboard.writeText(tekst); } catch { /* stil */ }
  }

  const loginUrl = resultaat ? `/m/login?email=${encodeURIComponent(resultaat.email)}` : "";

  return (
    <div
      className="card"
      style={{ border: "1px dashed var(--card-border, rgba(255,255,255,0.12))" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical size={14} style={{ color: hex }} />
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
          Test-account (dev)
        </p>
      </div>
      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Maakt of reset een test-medewerker met PIN <strong>1111</strong>, alles ingevuld, gekoppeld aan alle 3 vestigingen. Handig om het <code>/m</code>-portaal te bekijken zoals een medewerker dat ziet.
      </p>

      {!resultaat && (
        <button
          type="button"
          onClick={seed}
          disabled={bezig}
          className="px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider flex items-center gap-2"
          style={{ background: hex, color: "#000", minHeight: 36 }}
        >
          {bezig ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
          {bezig ? "Aanmaken…" : "Maak test-medewerker"}
        </button>
      )}

      {fout && (
        <p className="text-[12px] mt-2" style={{ color: "var(--sf-danger, #FF3D5C)" }}>{fout}</p>
      )}

      {resultaat && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text)" }}>
            <Check size={14} style={{ color: hex }} /> {resultaat.bericht}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => kopieer(resultaat.email)}
              className="px-3 py-2 rounded-lg font-mono text-[10px] flex items-center justify-center gap-1"
              style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", color: "var(--text)" }}
            >
              <Copy size={11} /> {resultaat.email}
            </button>
            <button
              type="button"
              onClick={() => kopieer(resultaat.pin)}
              className="px-3 py-2 rounded-lg font-mono text-[10px] flex items-center justify-center gap-1"
              style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", color: "var(--text)" }}
            >
              <Copy size={11} /> PIN {resultaat.pin}
            </button>
          </div>
          <a
            href={resultaat.autoLogin ? "/m" : loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider mt-1"
            style={{ background: hex, color: "#000" }}
          >
            <ExternalLink size={11} /> {resultaat.autoLogin ? "Open /m (al ingelogd)" : "Open /m/login in nieuw tab"}
          </a>
          <button
            type="button"
            onClick={seed}
            disabled={bezig}
            className="block px-3 py-2 rounded-lg font-mono text-[10px] mt-2"
            style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", color: "var(--muted)" }}
          >
            {bezig ? "Resetten…" : "Nogmaals resetten"}
          </button>
        </div>
      )}
    </div>
  );
}
