"use client";

/**
 * Drie loading-patterns voor verschillende contexten:
 *
 * - <Pulse>      — kleine pulsende dot, voor inline "bezig"-indicator
 * - <ScanBar>    — horizontale cyan bar die heen-en-weer scant, voor "fetch in progress"
 * - <Shimmer>    — skeleton-placeholder met cyan shimmer voor data-loaded content
 *
 * Geen spinner — die voelt te Material en niet sci-fi.
 */
import { motion } from "framer-motion";

export function Pulse({ label = "Bezig" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-label={label}>
      <motion.span
        className="block w-2 h-2 rounded-full"
        style={{
          background: "var(--sf-accent)",
          boxShadow: "0 0 8px var(--sf-accent-glow)",
        }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="font-mono text-sf-caps text-sf-fg-muted uppercase tracking-wider">
        {label}
      </span>
    </span>
  );
}

export function ScanBar({ height = 2 }: { height?: number }) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height, background: "var(--sf-hairline)" }}
      role="status"
      aria-label="Laden"
    >
      <motion.div
        className="absolute top-0 bottom-0"
        style={{
          width: "30%",
          background: "linear-gradient(90deg, transparent, var(--sf-accent), transparent)",
          boxShadow: "0 0 8px var(--sf-accent-glow)",
        }}
        animate={{ left: ["-30%", "100%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function Shimmer({
  width = "100%",
  height = 12,
  className = "",
}: { width?: number | string; height?: number; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-sf-sm ${className}`}
      style={{ width, height, background: "var(--sf-bg-surface)" }}
      role="presentation"
      aria-hidden
    >
      <motion.div
        className="absolute inset-y-0"
        style={{
          width: "60%",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.08) 50%, transparent 100%)",
        }}
        animate={{ left: ["-60%", "100%"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
