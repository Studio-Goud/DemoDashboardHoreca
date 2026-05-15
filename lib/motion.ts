/**
 * Motion-presets voor framer-motion, gekoppeld aan de sci-fi tokens in
 * globals.css (`--sf-*`). Importeer en gebruik direct in components:
 *
 *   import { motion } from "framer-motion";
 *   import { springStiff, fadeUp, stagger } from "@/lib/motion";
 *
 *   <motion.div {...fadeUp}>...</motion.div>
 *   <motion.ul variants={stagger.container}><motion.li variants={stagger.item}/>...</motion.ul>
 *
 * Hou de presets ARM — elke nieuwe variant moet een echt nieuwe behoefte
 * vertegenwoordigen, niet een micro-tweak van een bestaande.
 */
import type { Transition, Variants } from "framer-motion";

// ─── Springs ──────────────────────────────────────────────────────────

/**
 * Default spring — een lichte overshoot, voelt "fysiek". Voor de meeste
 * micro-animaties (button-press, modal-open, layout-shifts).
 */
export const springStiff: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/**
 * Zachte spring — voor grotere/zwaardere bewegingen (modal-sheets,
 * page-transitions). Geen overshoot.
 */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 26,
  mass: 1,
};

/**
 * Snap — iOS-stijl deceleration. Voor reveals, scroll-driven.
 */
export const easeSnap: Transition = {
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1],
};

// ─── Standaard fade/slide presets ─────────────────────────────────────

/**
 * Element komt op met fade + lichte slide omhoog. Voor cards, banners,
 * elementen die in beeld scrollen.
 */
export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: springStiff,
};

/**
 * Element komt op met fade + scale. Voor modals, hero-elementen.
 */
export const popIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.96 },
  transition: springStiff,
};

/**
 * Een blur-fade — element komt op met blur die wegtrekt. Cinematic.
 * Werkt mooi op hero-cijfers en boot-sequences.
 */
export const blurIn = {
  initial: { opacity: 0, filter: "blur(12px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  transition: { ...easeSnap, duration: 0.6 },
};

// ─── Stagger — voor lijsten ───────────────────────────────────────────

/**
 * Container + item variant voor stagger-animaties. Geef de container
 * `variants={stagger.container}` en elk kind `variants={stagger.item}`.
 */
export const stagger: { container: Variants; item: Variants } = {
  container: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: springStiff },
  },
};

// ─── Tap / hover micro-interactions ───────────────────────────────────

/**
 * Standaard interactive transform — voor buttons, cards. Press = 0.97,
 * hover = subtiele lift via shadow (CSS).
 */
export const tap = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.1, ease: "easeOut" },
};
