"use client";

import { useTaal } from "@/lib/i18n/TaalProvider";
import { TALEN, type Taal } from "@/lib/i18n/dictionaries";

/**
 * Taal-tab inhoud. In plaats van een dropdown (die werd weggeclipt door
 * de overflow van de nav-balk) tonen we de 3 talen als grote keuze-kaarten.
 * De geselecteerde taal heeft een gekleurde rand en check-indicator.
 */
export default function TaalPagina() {
  const { taal, setTaal } = useTaal();

  return (
    <div className="card">
      <p className="eyebrow mb-1">Taal · Language · Idioma</p>
      <h2 className="text-[16px] font-semibold mb-4" style={{ color: "var(--text)" }}>
        Kies een taal voor de app
      </h2>
      <div className="grid gap-2">
        {TALEN.map((t) => {
          const actief = t.code === taal;
          return (
            <button
              key={t.code}
              onClick={() => setTaal(t.code as Taal)}
              className="flex items-center gap-3 rounded-[12px] px-4 py-3 transition-all text-left"
              style={{
                background: actief ? "var(--bg-elev)" : "var(--bg)",
                border: `1px solid ${actief ? "var(--text-2)" : "var(--hairline)"}`,
                boxShadow: actief ? "0 2px 10px -4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              <span className="text-[28px] leading-none">{t.vlag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
                  {t.naam}
                </p>
                <p className="text-[11px] tracking-wide uppercase" style={{ color: "var(--muted)" }}>
                  {t.code}
                </p>
              </div>
              {actief && (
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold"
                  style={{ background: "var(--text)", color: "var(--bg)" }}
                  aria-label="Actieve taal"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
