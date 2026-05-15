"use client";

/**
 * Klant-feedback form — sterren, optionele tekst, submit. Na submit
 * toont een dank-scherm met optionele Google-passthrough knop (alleen
 * als owner een place-URL heeft ingevuld). De Google-knop opent met
 * een neutrale template ZONDER medewerker-naam — conform Google's
 * 2023 anti-incentive policy.
 */
import { useState } from "react";
import { Star, Check, Loader2, ExternalLink } from "lucide-react";

interface Props {
  bedrijfSlug: string;
  bedrijfNaam: string;
  datum: string;
  hex: string;
  googleUrl: string;
}

export default function FeedbackForm({ bedrijfSlug, bedrijfNaam, datum, hex, googleUrl }: Props) {
  const [sterren, setSterren] = useState(0);
  const [hover, setHover] = useState(0);
  const [tekst, setTekst] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "fout">("idle");
  const [fout, setFout] = useState("");

  async function submit() {
    if (sterren < 1) return;
    setStatus("submitting");
    setFout("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedrijf: bedrijfSlug, datum, sterren, tekst }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Kon niet versturen");
      }
      setStatus("ok");
    } catch (e: unknown) {
      setStatus("fout");
      setFout(e instanceof Error ? e.message : "Kon niet versturen");
    }
  }

  if (status === "ok") {
    return (
      <div className="card text-center">
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: `${hex}22`, color: hex }}
          >
            <Check size={28} />
          </div>
        </div>
        <h2 className="font-display text-[22px] font-semibold mb-2" style={{ color: "var(--text, #E8ECF4)" }}>
          Bedankt!
        </h2>
        <p className="text-[14px] mb-6" style={{ color: "var(--muted, #8A8F9C)" }}>
          Je feedback wordt direct gedeeld met het team van vandaag.
        </p>
        {googleUrl && sterren >= 4 && (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-[12px] uppercase tracking-wider"
            style={{ background: hex, color: "#000" }}
          >
            Help ons ook op Google <ExternalLink size={14} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <p
        className="font-mono text-[10px] tracking-[0.18em] uppercase mb-3"
        style={{ color: "var(--muted, #8A8F9C)" }}
      >
        Geef je beoordeling
      </p>
      <div className="flex justify-center gap-2 mb-6" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const aan = (hover || sterren) >= n;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} ster${n > 1 ? "ren" : ""}`}
              onClick={() => setSterren(n)}
              onMouseEnter={() => setHover(n)}
              className="p-2 transition-transform active:scale-90"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Star
                size={36}
                fill={aan ? hex : "transparent"}
                stroke={aan ? hex : "var(--muted, #8A8F9C)"}
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>

      <label className="block mb-4">
        <span
          className="block font-mono text-[10px] tracking-[0.18em] uppercase mb-2"
          style={{ color: "var(--muted, #8A8F9C)" }}
        >
          Korte toelichting (optioneel)
        </span>
        <textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Wat ging er goed of beter?"
          className="w-full rounded-lg px-3 py-2.5 text-[14px] resize-none"
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.04))",
            border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
            color: "var(--text, #E8ECF4)",
          }}
        />
        <span className="block text-right font-mono text-[10px] mt-1" style={{ color: "var(--muted, #8A8F9C)" }}>
          {tekst.length}/500
        </span>
      </label>

      {fout && (
        <p className="text-[12px] mb-3" style={{ color: "var(--sf-danger, #FF3D5C)" }}>
          {fout}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={sterren < 1 || status === "submitting"}
        className="w-full py-3 rounded-lg font-mono text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
        style={{ background: hex, color: "#000", minHeight: 44 }}
      >
        {status === "submitting" ? <><Loader2 size={16} className="animate-spin" /> Versturen…</> : "Versturen"}
      </button>

      <p className="text-center text-[10px] mt-4" style={{ color: "var(--muted, #8A8F9C)" }}>
        Voor {bedrijfNaam} · {datum}
      </p>
    </div>
  );
}
