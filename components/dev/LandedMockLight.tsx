"use client";

/**
 * Light variant van LandedMock — "clean lab" stijl: wit/off-white surface
 * met cyan als accent (geen glow), ink-blue tekst, fijne hairlines.
 */
import { motion } from "framer-motion";
import { fadeUp, stagger } from "@/lib/motion";

const VESTIGINGEN = [
  { naam: "Brunch & Brew", omzet: "€1.847", klanten: 23, dot: "#0095B0" },
  { naam: "Saté Lounge", omzet: "€940", klanten: 11, dot: "#0F9D58" },
  { naam: "Het Kroket Loket", omzet: "€612", klanten: 14, dot: "#D97706" },
];

const INK = "#0F1525";
const MUTED = "#5A6478";
const DIM = "#9AA3B5";

export default function LandedMockLight({ delay = 0 }: { delay?: number }) {
  return (
    <motion.section
      className="relative z-10 px-6 pt-10 max-w-md mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: delay / 1000 }}
    >
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: (delay + 200) / 1000 }}>
        <p
          className="font-mono text-[10px] tracking-[0.18em] uppercase mb-2"
          style={{ color: "#0095B0" }}
        >
          Markthal HQ · LIVE
        </p>
        <h1
          className="font-display text-sf-display tracking-tight mb-1"
          style={{ color: INK }}
        >
          €3.399
        </h1>
        <p className="font-mono text-sf-mono" style={{ color: MUTED }}>
          ↑ <span style={{ color: "#0F9D58" }}>+18.4%</span> vs gem. donderdag
        </p>
      </motion.div>

      <motion.ul
        className="mt-8 space-y-2"
        variants={stagger.container}
        initial="initial"
        animate="animate"
        transition={{ delay: (delay + 400) / 1000 }}
      >
        {VESTIGINGEN.map((v) => (
          <motion.li
            key={v.naam}
            variants={stagger.item}
            className="flex items-center justify-between rounded-sf-lg p-4"
            style={{
              background: "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(15, 21, 37, 0.08)",
              boxShadow: "0 1px 2px rgba(15, 21, 37, 0.04)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full" style={{ background: v.dot }} />
              <span className="font-display text-sf-body" style={{ color: INK }}>
                {v.naam}
              </span>
            </div>
            <div className="text-right">
              <p className="font-mono text-sf-mono" style={{ color: INK }}>
                {v.omzet}
              </p>
              <p className="font-mono text-[10px] tracking-wider" style={{ color: DIM }}>
                {v.klanten} klanten
              </p>
            </div>
          </motion.li>
        ))}
      </motion.ul>

      <motion.p
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: (delay + 700) / 1000 }}
        className="mt-10 text-center font-mono text-[10px] tracking-[0.15em] uppercase"
        style={{ color: DIM }}
      >
        System ready · {new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
      </motion.p>
    </motion.section>
  );
}
