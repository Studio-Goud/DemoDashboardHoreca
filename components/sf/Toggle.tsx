"use client";

/**
 * iOS-stijl toggle met sci-fi twist: cyan glow op active state, smooth
 * thumb-spring. 44pt tap-target (hele label + switch).
 */
import { useId } from "react";
import { motion } from "framer-motion";
import { springStiff } from "@/lib/motion";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  beschrijving?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, beschrijving, disabled }: Props) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4 min-h-[44px] py-1.5 cursor-pointer"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <span className="flex-1 min-w-0">
        <span className="block font-display text-sf-body text-sf-fg">{label}</span>
        {beschrijving && (
          <span className="block text-sf-small text-sf-fg-muted mt-0.5">
            {beschrijving}
          </span>
        )}
      </span>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative shrink-0 rounded-full transition-colors duration-sf-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          width: 50,
          height: 30,
          background: checked ? "var(--sf-accent)" : "var(--sf-bg-overlay)",
          border: `1px solid ${checked ? "var(--sf-accent)" : "var(--sf-hairline-strong)"}`,
          boxShadow: checked ? "0 0 16px var(--sf-accent-glow), inset 0 0 8px rgba(0,0,0,0.2)" : "inset 0 1px 2px rgba(0,0,0,0.4)",
        }}
      >
        <motion.span
          aria-hidden
          className="absolute top-[2px] left-[2px] rounded-full"
          animate={{ x: checked ? 20 : 0 }}
          transition={springStiff}
          style={{
            width: 24,
            height: 24,
            background: checked ? "var(--sf-bg)" : "var(--sf-fg-muted)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        />
      </button>
    </label>
  );
}
