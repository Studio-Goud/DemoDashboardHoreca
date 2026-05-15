"use client";

/**
 * Lijst-rij met hairline-divider en accent-line-left bij hover. 44pt
 * minimum hoogte voor tap. Optionele leading icon, trailing value/icon.
 */
import { motion } from "framer-motion";
import { tap as tapPreset } from "@/lib/motion";

interface Props {
  leading?: React.ReactNode;        // bv. icoon of avatar
  label: string;
  ondertitel?: string;
  trailing?: React.ReactNode;       // bv. waarde of chevron
  /** Maakt 'm tappable; renders als button. */
  onClick?: () => void;
  /** Voor link-gedrag, gebruik <Link asChild> wrapper. Default: laat onClick weg en wrap zelf. */
  ariaLabel?: string;
  isLast?: boolean;
}

export default function ListRow({
  leading,
  label,
  ondertitel,
  trailing,
  onClick,
  ariaLabel,
  isLast,
}: Props) {
  const Tag: "button" | "div" = onClick ? "button" : "div";
  const inhoud = (
    <>
      {/* Accent-line links — verschijnt op hover/focus */}
      <span
        aria-hidden
        className="absolute left-0 top-2 bottom-2 w-[2px] opacity-0 transition-opacity duration-sf-fast"
        style={{
          background: "var(--sf-accent)",
          boxShadow: "0 0 8px var(--sf-accent-glow)",
        }}
      />
      {leading && (
        <span className="shrink-0 text-sf-fg-muted">
          {leading}
        </span>
      )}
      <span className="flex-1 min-w-0 text-left">
        <span className="block font-display text-sf-body text-sf-fg truncate">
          {label}
        </span>
        {ondertitel && (
          <span className="block font-mono text-sf-caps text-sf-fg-dim mt-0.5">
            {ondertitel}
          </span>
        )}
      </span>
      {trailing && (
        <span className="shrink-0 text-sf-fg-muted">{trailing}</span>
      )}
    </>
  );

  if (Tag === "button") {
    return (
      <motion.button
        whileTap={{ scale: 0.99 }}
        transition={tapPreset.transition}
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        className={`group relative w-full min-h-[44px] flex items-center gap-3 px-4 py-2.5 text-left hover:[&>span:first-child]:opacity-100 ${isLast ? "" : "border-b"}`}
        style={{ borderColor: "var(--sf-hairline)" }}
      >
        {inhoud}
      </motion.button>
    );
  }
  return (
    <div
      className={`relative min-h-[44px] flex items-center gap-3 px-4 py-2.5 ${isLast ? "" : "border-b"}`}
      style={{ borderColor: "var(--sf-hairline)" }}
    >
      {inhoud}
    </div>
  );
}
