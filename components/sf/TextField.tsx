"use client";

/**
 * Underline-style textfield. Bij focus "typt" een cyan onderlijn van
 * links naar rechts. Label boven het veld (caps) — programmatisch
 * gekoppeld via htmlFor/id (verplicht voor screenreaders).
 */
import { forwardRef, useId, useState } from "react";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  hint?: string;
  /** Right-aligned mono-unit, bv. "€" of "%". */
  unit?: string;
  fout?: string | null;
}

const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, hint, unit, fout, className = "", onFocus, onBlur, id: passedId, ...rest },
  ref,
) {
  const autoId = useId();
  const id = passedId ?? autoId;
  const [focused, setFocused] = useState(false);

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="block font-mono text-sf-caps text-sf-fg-muted uppercase mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        {unit && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-sf-mono text-sf-fg-muted pointer-events-none">
            {unit}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full bg-transparent text-sf-body text-sf-fg placeholder:text-sf-fg-dim font-display py-2.5 outline-none transition-colors ${unit ? "pl-6" : ""} ${className}`}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          aria-invalid={fout ? true : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...rest}
        />
        {/* Base hairline */}
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "var(--sf-hairline-strong)" }}
        />
        {/* Accent line — "typt" in vanaf links bij focus */}
        <div
          className="absolute left-0 bottom-0 h-[1.5px] transition-all duration-sf-base ease-sf-snap"
          style={{
            width: focused || fout ? "100%" : "0%",
            background: fout ? "var(--sf-danger)" : "var(--sf-accent)",
            boxShadow: focused && !fout ? "0 0 8px var(--sf-accent-glow)" : undefined,
          }}
        />
      </div>
      {(hint || fout) && (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-sf-small"
          style={{ color: fout ? "var(--sf-danger)" : "var(--sf-fg-muted)" }}
        >
          {fout ?? hint}
        </p>
      )}
    </div>
  );
});

export default TextField;
