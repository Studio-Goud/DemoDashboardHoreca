"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Wanneer true: overlay zichtbaar */
  zichtbaar: boolean;
  /** Hoofdtekst, bv. "AI maakt het rooster…" */
  titel: string;
  /** Optionele subtitel — bv. "Dit kan 1-5 minuten duren" */
  subtitel?: string;
  /** Hex-accent voor de spinner — default systeem-blauw */
  accent?: string;
  /** Toon een live tijdsteller (mm:ss) — handig voor lange acties */
  toonTimer?: boolean;
}

/**
 * Full-screen overlay met spinner + tekst voor lang-durende async acties.
 * Pakt de hele viewport zodat de gebruiker geen twijfel heeft dat iets
 * gebeurt — geen knoppen meer klikbaar in achtergrond, knipperende dots
 * en een tikkende timer (optioneel) om te laten zien dat we leven.
 */
export default function LoadingOverlay({
  zichtbaar,
  titel,
  subtitel,
  accent = "#0A84FF",
  toonTimer = false,
}: Props) {
  const [seconden, setSeconden] = useState(0);

  useEffect(() => {
    if (!zichtbaar) {
      setSeconden(0);
      return;
    }
    const id = setInterval(() => setSeconden((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [zichtbaar]);

  if (!zichtbaar) return null;

  const mm = Math.floor(seconden / 60);
  const ss = seconden % 60;
  const tijd = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={titel}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 fade-up"
      style={{
        background: "color-mix(in srgb, var(--bg) 80%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        className="rounded-[18px] px-6 py-8 text-center max-w-sm w-full"
        style={{
          background: "var(--bg-elev)",
          border: `1px solid ${accent}33`,
          boxShadow: `0 8px 40px -8px ${accent}44, 0 2px 4px rgba(0,0,0,0.04)`,
        }}
      >
        {/* Spinner */}
        <div className="flex justify-center mb-5">
          <div
            className="w-12 h-12 rounded-full animate-spin"
            style={{
              border: "3px solid var(--hairline)",
              borderTopColor: accent,
            }}
          />
        </div>

        {/* Titel + animerende dots */}
        <p
          className="text-[16px] font-semibold tracking-tight mb-1"
          style={{ color: "var(--text)", letterSpacing: "-0.014em" }}
        >
          {titel}
          <span className="inline-block ml-0.5 animate-pulse">…</span>
        </p>

        {subtitel && (
          <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
            {subtitel}
          </p>
        )}

        {toonTimer && (
          <p
            className="text-[12px] tabular-nums mt-3 inline-flex items-center gap-1.5"
            style={{ color: accent }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
            />
            {tijd}
          </p>
        )}
      </div>
    </div>
  );
}
