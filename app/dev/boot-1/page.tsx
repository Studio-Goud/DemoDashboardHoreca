"use client";

/**
 * Variant 01 — Grid Render
 *
 * Beat-sheet:
 *   0    — black
 *   100  — grid lines staggered fade-in from center outward (radial)
 *   400  — horizontal scan-sweep starts (top→bottom, 800ms)
 *   800  — logo blurs in
 *   1500 — ambient: grid lives on at low opacity, breathing
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LandedMock from "@/components/dev/LandedMock";

export default function BootGridRender() {
  const [fase, setFase] = useState<"boot" | "landed">("boot");

  useEffect(() => {
    const t = setTimeout(() => setFase("landed"), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient grid — blijft tijdens beide fases, animeert per fase. */}
      <GridAmbient fase={fase} />

      {/* Scan sweep — alleen in boot-fase. */}
      <AnimatePresence>
        {fase === "boot" && (
          <motion.div
            key="sweep"
            className="absolute inset-x-0 pointer-events-none z-20"
            initial={{ top: "-2px" }}
            animate={{ top: "100%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1], delay: 0.4 }}
            style={{
              height: 2,
              background: "linear-gradient(90deg, transparent, var(--sf-accent) 50%, transparent)",
              boxShadow: "0 0 24px var(--sf-accent), 0 0 4px var(--sf-accent)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Boot logo */}
      <AnimatePresence>
        {fase === "boot" && (
          <motion.div
            key="logo"
            className="absolute inset-0 flex items-center justify-center z-10"
            initial={{ opacity: 0, filter: "blur(12px)", scale: 0.96 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            exit={{ opacity: 0, filter: "blur(8px)", scale: 1.02 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
          >
            <div className="text-center">
              <p
                className="font-mono text-[10px] tracking-[0.3em] uppercase mb-4"
                style={{ color: "var(--sf-accent)" }}
              >
                Markthal
              </p>
              <h1
                className="font-display text-[64px] leading-none tracking-tight"
                style={{
                  color: "var(--sf-fg)",
                  textShadow: "0 0 32px var(--sf-accent-glow)",
                }}
              >
                HQ
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Landed mock — verschijnt na boot. */}
      {fase === "landed" && <LandedMock />}
    </main>
  );
}

/**
 * Grid dat zich opbouwt vanuit centrum tijdens boot, en lager pulseert
 * tijdens landed.
 */
function GridAmbient({ fase }: { fase: "boot" | "landed" }) {
  const lines = 14;
  const cellSize = 60;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: fase === "landed" ? 0.18 : 1 }}
    >
      <defs>
        <linearGradient id="gridFade" x1="50%" y1="50%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--sf-accent)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--sf-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Vertical lines, animated stagger from center */}
      {Array.from({ length: lines * 2 + 1 }).map((_, i) => {
        const offsetFromCenter = Math.abs(i - lines);
        const delay = offsetFromCenter * 0.04;
        return (
          <motion.line
            key={`v${i}`}
            x1={`${50 + (i - lines) * (cellSize / 8)}%`}
            x2={`${50 + (i - lines) * (cellSize / 8)}%`}
            y1="0%"
            y2="100%"
            stroke="var(--sf-accent)"
            strokeWidth={0.5}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "boot" ? [0, 0.25, 0.12] : 0.06,
            }}
            transition={{ duration: 0.6, delay, ease: "easeOut" }}
          />
        );
      })}

      {/* Horizontal lines */}
      {Array.from({ length: 12 }).map((_, i) => {
        const offsetFromCenter = Math.abs(i - 6);
        const delay = 0.1 + offsetFromCenter * 0.04;
        return (
          <motion.line
            key={`h${i}`}
            x1="0%"
            x2="100%"
            y1={`${(i / 11) * 100}%`}
            y2={`${(i / 11) * 100}%`}
            stroke="var(--sf-accent)"
            strokeWidth={0.5}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "boot" ? [0, 0.2, 0.1] : 0.05,
            }}
            transition={{ duration: 0.6, delay, ease: "easeOut" }}
          />
        );
      })}

      {/* Center pulse — een traag breathend cirkel-glow op de home. */}
      {fase === "landed" && (
        <motion.circle
          cx="50%"
          cy="40%"
          r="200"
          fill="url(#gridFade)"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
