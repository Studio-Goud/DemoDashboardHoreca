"use client";

/**
 * HUD-stijl progress-bar: dunne track, cyan fill met glow, percentage
 * in monospace. Determinate (waarde 0-100).
 */
import { motion } from "framer-motion";

interface Props {
  /** 0-100 */
  waarde: number;
  /** Toon percentage label rechts. Default: true. */
  toonPercentage?: boolean;
  /** Optioneel label links boven de bar. */
  label?: string;
  className?: string;
}

export default function Progress({ waarde, toonPercentage = true, label, className = "" }: Props) {
  const pct = Math.max(0, Math.min(100, waarde));
  return (
    <div className={`w-full ${className}`}>
      {(label || toonPercentage) && (
        <div className="flex items-baseline justify-between mb-1.5">
          {label && (
            <span className="font-mono text-sf-caps uppercase tracking-wider text-sf-fg-muted">
              {label}
            </span>
          )}
          {toonPercentage && (
            <span className="font-mono text-sf-small text-sf-accent tabular-nums">
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className="relative w-full overflow-hidden rounded-sf-sm"
        style={{ height: 4, background: "var(--sf-hairline)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-sf-sm"
          style={{
            background: "var(--sf-accent)",
            boxShadow: "0 0 8px var(--sf-accent-glow)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
