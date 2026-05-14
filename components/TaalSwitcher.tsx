"use client";

import { useState, useRef, useEffect } from "react";
import { useTaal } from "@/lib/i18n/TaalProvider";
import { TALEN, type Taal } from "@/lib/i18n/dictionaries";

interface Props {
  /** Compacte variant: alleen vlag + dropdown */
  compact?: boolean;
}

export default function TaalSwitcher({ compact }: Props) {
  const { taal, setTaal } = useTaal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sluit op klik buiten
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const huidige = TALEN.find((t) => t.code === taal) ?? TALEN[0];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all"
        style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--hairline)",
          color: "var(--text)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
        aria-label="Taal kiezen"
      >
        <span className="text-[14px] leading-none">{huidige.vlag}</span>
        {!compact && <span className="tracking-wide" style={{ color: "var(--text-2)" }}>{huidige.code.toUpperCase()}</span>}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-[10px] shadow-elev py-1 z-50 min-w-[140px]"
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline)",
          }}
        >
          {TALEN.map((t) => {
            const actief = t.code === taal;
            return (
              <button
                key={t.code}
                onClick={() => { setTaal(t.code as Taal); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors"
                style={{
                  color: actief ? "var(--text)" : "var(--text-2)",
                  background: actief ? "var(--bg)" : "transparent",
                  fontWeight: actief ? 600 : 400,
                }}
              >
                <span className="text-[16px]">{t.vlag}</span>
                <span>{t.naam}</span>
                {actief && (
                  <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
