"use client";

/**
 * Scroll-reveal wrapper. Wikkel om content die "in beeld" moet komen
 * met fade+blur+slide. Gebruikt IntersectionObserver — geen scroll-listener
 * dus geen jank bij snel scrollen.
 *
 *   <Reveal>
 *     <KerncijfersGrid ... />
 *   </Reveal>
 *
 *   <Reveal delay={0.1}>
 *     <Card>...</Card>
 *   </Reveal>
 *
 * Reduced-motion respect zit in framer-motion (useReducedMotion zorgt
 * dat animaties no-op worden) + de globale prefers-reduced-motion block.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  children: React.ReactNode;
  /** Delay in seconden vanaf het moment van in-view. */
  delay?: number;
  /** Verschuif-afstand in px (default 16). 0 = alleen fade. */
  offset?: number;
  /** Vroeger triggeren voordat element volledig in beeld is (px). */
  rootMargin?: string;
  /** One-shot of elke keer triggeren bij in/uit-view (default one-shot). */
  once?: boolean;
  className?: string;
}

export default function Reveal({
  children,
  delay = 0,
  offset = 16,
  rootMargin = "0px 0px -10% 0px",
  once = true,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [zichtbaar, setZichtbaar] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setZichtbaar(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setZichtbaar(false);
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, once]);

  // Reduced-motion: geen blur/translate, gewoon zichtbaar tonen.
  if (reduceMotion) {
    return <div ref={ref} className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: offset, filter: "blur(8px)" }}
      animate={
        zichtbaar
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y: offset, filter: "blur(8px)" }
      }
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
