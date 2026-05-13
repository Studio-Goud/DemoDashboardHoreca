"use client";

import { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/useT";
import { TALEN, type Taal } from "@/lib/i18n/dictionaries";

interface Props {
  /** Compacte variant: alleen vlag + dropdown */
  compact?: boolean;
}

export default function TaalSwitcher({ compact }: Props) {
  const { taal, setTaal } = useT();
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
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] transition-colors"
        style={{ color: "var(--muted)" }}
        aria-label="Taal kiezen"
      >
        <span className="text-[14px] leading-none">{huidige.vlag}</span>
        {!compact && <span className="font-medium">{huidige.code.toUpperCase()}</span>}
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
