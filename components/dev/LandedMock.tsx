"use client";

/**
 * Shared "landed" home-mock voor de boot-demo's. Wordt na de boot-
 * sequence onthuld zodat je het ambient-effect in context kunt
 * beoordelen. Geen echte data — alleen layout-tonen.
 */
import { motion } from "framer-motion";
import { fadeUp, stagger } from "@/lib/motion";

const VESTIGINGEN = [
  { naam: "Brunch & Brew", omzet: "€1.847", klanten: 23, dot: "#00E5FF" },
  { naam: "Saté Lounge", omzet: "€940", klanten: 11, dot: "#00FF94" },
  { naam: "Het Kroket Loket", omzet: "€612", klanten: 14, dot: "#FFB800" },
];

export default function LandedMock({ delay = 0 }: { delay?: number }) {
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
          style={{ color: "var(--sf-accent)" }}
        >
          Markthal HQ · LIVE
        </p>
        <h1
          className="font-display text-sf-display tracking-tight mb-1"
          style={{ color: "var(--sf-fg)" }}
        >
          €3.399
        </h1>
        <p className="font-mono text-sf-mono" style={{ color: "var(--sf-fg-muted)" }}>
          ↑ <span style={{ color: "var(--sf-success)" }}>+18.4%</span> vs gem. donderdag
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
            className="flex items-center justify-between rounded-sf-lg p-4 backdrop-blur-sf"
            style={{
              background: "var(--sf-glass)",
              border: "1px solid var(--sf-hairline)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: v.dot, boxShadow: `0 0 8px ${v.dot}` }}
              />
              <span className="font-display text-sf-body" style={{ color: "var(--sf-fg)" }}>
                {v.naam}
              </span>
            </div>
            <div className="text-right">
              <p className="font-mono text-sf-mono" style={{ color: "var(--sf-fg)" }}>
                {v.omzet}
              </p>
              <p
                className="font-mono text-[10px] tracking-wider"
                style={{ color: "var(--sf-fg-dim)" }}
              >
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
        style={{ color: "var(--sf-fg-dim)" }}
      >
        System ready · {new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
      </motion.p>
    </motion.section>
  );
}
