"use client";

/**
 * Variant 03 — HUD Boot Sequence
 *
 * Beat-sheet:
 *   0-1300 — monospace readout typt regel-voor-regel ("> INIT ... OK")
 *            met scanning sweep bovenaan + corner-tickers
 *   1300+  — glitchy logo-reveal in centrum
 *   1700   — landed; ambient: subtiele glow + corner-readouts blijven leven
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LandedMock from "@/components/dev/LandedMock";

const REGELS = [
  { tekst: "INIT MARKTHAL HQ", status: "OK", delay: 0 },
  { tekst: "LOADING SHIFTBASE", status: "OK", delay: 200 },
  { tekst: "SYNC ZETTLE......", status: "OK", delay: 400 },
  { tekst: "AUTH MODULE", status: "READY", delay: 600 },
  { tekst: "[SYSTEM ONLINE]", status: "", delay: 900 },
];

export default function BootHUD() {
  const [fase, setFase] = useState<"boot" | "logo" | "landed">("boot");

  useEffect(() => {
    const t1 = setTimeout(() => setFase("logo"), 1300);
    const t2 = setTimeout(() => setFase("landed"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Subtiele grid-achtergrond, blijft door alle fases. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--sf-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--sf-hairline) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.4,
        }}
      />

      {/* Sweep bar bovenaan tijdens boot. */}
      <AnimatePresence>
        {fase === "boot" && (
          <motion.div
            key="sweep"
            className="absolute inset-x-0 top-0 pointer-events-none z-30"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.3, ease: "linear" }}
            style={{
              height: 1.5,
              background:
                "linear-gradient(90deg, transparent, var(--sf-accent), transparent)",
              boxShadow: "0 0 20px var(--sf-accent)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Corner tickers — staan altijd. */}
      <CornerReadouts fase={fase} />

      {/* Boot readout — typewriter regels in centrum. */}
      <AnimatePresence>
        {fase === "boot" && (
          <motion.div
            key="readout"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="font-mono text-[12px] space-y-1.5">
              {REGELS.map((r) => (
                <motion.div
                  key={r.tekst}
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.18,
                    delay: r.delay / 1000,
                    ease: "easeOut",
                  }}
                >
                  <span style={{ color: "var(--sf-fg-muted)" }}>&gt;</span>
                  <span style={{ color: "var(--sf-fg)" }}>{r.tekst}</span>
                  {r.status && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: (r.delay + 120) / 1000, duration: 0.12 }}
                      style={{
                        color:
                          r.status === "OK"
                            ? "var(--sf-success)"
                            : "var(--sf-accent)",
                      }}
                    >
                      [{r.status}]
                    </motion.span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glitch-logo reveal. */}
      <AnimatePresence>
        {fase === "logo" && (
          <motion.div
            key="logo"
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GlitchLogo />
          </motion.div>
        )}
      </AnimatePresence>

      {fase === "landed" && <LandedMock />}
    </main>
  );
}

/** Logo dat door glitch-frames flikkert voordat 'ie stilstaat. */
function GlitchLogo() {
  return (
    <div className="text-center">
      <motion.h1
        className="font-display text-[56px] leading-none tracking-tight"
        style={{ color: "var(--sf-fg)", textShadow: "0 0 32px var(--sf-accent-glow)" }}
        animate={{
          x: [0, -2, 1, 0],
          skewX: [0, 2, -1, 0],
          filter: [
            "drop-shadow(0 0 0 transparent)",
            "drop-shadow(2px 0 0 var(--sf-accent))",
            "drop-shadow(-2px 0 0 var(--sf-accent-2))",
            "drop-shadow(0 0 0 transparent)",
          ],
        }}
        transition={{ duration: 0.5, times: [0, 0.15, 0.3, 0.55] }}
      >
        Markthal HQ
      </motion.h1>
      <motion.p
        className="font-mono text-[10px] tracking-[0.3em] uppercase mt-4"
        style={{ color: "var(--sf-accent)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        System online
      </motion.p>
    </div>
  );
}

/** Vier corner-readouts met tickende waardes — geeft het HUD-gevoel. */
function CornerReadouts({ fase }: { fase: "boot" | "logo" | "landed" }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 800);
    return () => clearInterval(i);
  }, []);

  // 4 corner-strings die ticken — willekeurig maar consistent.
  const codes = [
    `HQ.${String(tick % 999).padStart(3, "0")}`,
    `${["BB", "SL", "KL"][tick % 3]}.LIVE`,
    `T+${String(tick).padStart(4, "0")}s`,
    `LAT.${(51.92 + (tick % 10) * 0.0001).toFixed(4)}`,
  ];

  return (
    <>
      {[
        { pos: "top-4 left-4", code: codes[0] },
        { pos: "top-4 right-4", code: codes[1] },
        { pos: "bottom-4 left-4", code: codes[2] },
        { pos: "bottom-4 right-4", code: codes[3] },
      ].map((c) => (
        <motion.div
          key={c.pos}
          className={`absolute ${c.pos} font-mono text-[10px] tracking-wider pointer-events-none z-30`}
          style={{ color: "var(--sf-accent)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: fase === "boot" ? 0.6 : 0.4 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {c.code}
        </motion.div>
      ))}
    </>
  );
}
