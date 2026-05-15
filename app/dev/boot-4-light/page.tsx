"use client";

/**
 * Variant 04 — Synthesis · LIGHT
 *
 * Zelfde concept als /dev/boot-4 (particles tekenen het grid in) maar
 * in "clean lab" stijl: off-white surface, ink-blue tekst, cyan als
 * lijn-accent zonder zware glow. Vision Pro-app-op-licht-mode vibe.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LandedMockLight from "@/components/dev/LandedMockLight";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  size: number;
  alpha: number;
  orbitPhase: number;
}

const PARTICLES_PER_INTERSECTION = 4;

// Light-theme palette — geen CSS-vars want we testen hier de kleur-keuze.
// Wordt later geconsolideerd in --sf-light-* tokens.
const INK = "#0F1525";
const MUTED = "#5A6478";
const ACCENT = "#0095B0";       // diepere cyan voor licht (i.p.v. #00E5FF)
const ACCENT_BRIGHT = "#00BCD4"; // voor scan-sweep + particles
const HAIRLINE = "rgba(15, 21, 37, 0.10)";

export default function BootSynthesisLight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<"chaos" | "convergeer" | "logo" | "landed">("chaos");
  const mouseRef = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;

    // Grid intersections — 6×5 gecentreerd
    const gridCols = 6;
    const gridRows = 5;
    const gridSpacingX = Math.min(110, w / (gridCols + 1));
    const gridSpacingY = Math.min(110, h / (gridRows + 1));
    const gridStartX = cx - ((gridCols - 1) / 2) * gridSpacingX;
    const gridStartY = cy - ((gridRows - 1) / 2) * gridSpacingY;
    const intersections: Array<{ x: number; y: number }> = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        intersections.push({
          x: gridStartX + c * gridSpacingX,
          y: gridStartY + r * gridSpacingY,
        });
      }
    }

    const particles: Particle[] = [];
    for (const ipoint of intersections) {
      const distCenter = Math.hypot(ipoint.x - cx, ipoint.y - cy);
      const weight = Math.max(1, Math.round(PARTICLES_PER_INTERSECTION - distCenter / 200));
      for (let k = 0; k < weight; k++) {
        const angle = Math.random() * Math.PI * 2;
        const startDist = 200 + Math.random() * Math.max(w, h);
        particles.push({
          x: ipoint.x + Math.cos(angle) * startDist,
          y: ipoint.y + Math.sin(angle) * startDist,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          targetX: ipoint.x,
          targetY: ipoint.y,
          size: 1.0 + Math.random() * 1.4,
          alpha: 0.7 + Math.random() * 0.3, // hoger opacity want lichte bg
          orbitPhase: Math.random() * Math.PI * 2,
        });
      }
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, w, h);

      const inConverge = elapsed > 500;
      const isLanded = elapsed > 1500;

      for (const p of particles) {
        if (isLanded) {
          p.orbitPhase += 0.008;
          const orbitX = p.targetX + Math.cos(p.orbitPhase) * 4;
          const orbitY = p.targetY + Math.sin(p.orbitPhase * 0.7) * 4;
          const dx = orbitX - p.x;
          const dy = orbitY - p.y;
          p.vx += dx * 0.04;
          p.vy += dy * 0.04;
          p.vx *= 0.85;
          p.vy *= 0.85;
          const mdx = p.x - mouseRef.current.x;
          const mdy = p.y - mouseRef.current.y;
          const mDist = Math.hypot(mdx, mdy);
          if (mDist < 120 && mDist > 0) {
            const force = (1 - mDist / 120) * 0.8;
            p.vx += (mdx / mDist) * force;
            p.vy += (mdy / mDist) * force;
          }
        } else if (inConverge) {
          p.vx += (p.targetX - p.x) * 0.022;
          p.vy += (p.targetY - p.y) * 0.022;
          p.vx *= 0.86;
          p.vy *= 0.86;
        }

        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        // Cyan met blue-ink core voor zichtbaarheid op licht
        ctx.fillStyle = `rgba(0, 149, 176, ${p.alpha})`;
        // Lichte glow — niet de bright cyan halo van dark mode
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(0, 188, 212, 0.5)";
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const t1 = setTimeout(() => setFase("convergeer"), 500);
    const t2 = setTimeout(() => setFase("logo"), 1100);
    const t3 = setTimeout(() => setFase("landed"), 1700);

    const onMove = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e && e.touches[0]) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if ("clientX" in e) {
        mouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        // Cool off-white met subtiele cyan-tint bovenaan en blauwe lift
        // onderaan — "clean lab" sfeer.
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(0, 188, 212, 0.10), transparent 55%), linear-gradient(180deg, #F8FAFD 0%, #ECF0F6 60%, #E2E8F1 100%)",
        color: INK,
      }}
    >
      <GridLines fase={fase} />

      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <AnimatePresence>
        {fase !== "landed" && (
          <motion.div
            key="sweep"
            className="absolute inset-x-0 pointer-events-none z-20"
            initial={{ top: "-2px", opacity: 0 }}
            animate={{ top: ["-2px", "100%"], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 1.0,
              delay: 0.7,
              ease: [0.65, 0, 0.35, 1],
              times: [0, 0.1, 0.9, 1],
            }}
            style={{
              height: 1.5,
              background: `linear-gradient(90deg, transparent, ${ACCENT_BRIGHT} 50%, transparent)`,
              boxShadow: `0 0 18px ${ACCENT_BRIGHT}, 0 0 4px ${ACCENT_BRIGHT}`,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(fase === "logo" || fase === "convergeer") && (
          <motion.div
            key="logo"
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            initial={{ opacity: 0, filter: "blur(14px)", scale: 0.96 }}
            animate={{
              opacity: fase === "logo" ? 1 : 0.15,
              filter: fase === "logo" ? "blur(0px)" : "blur(8px)",
              scale: fase === "logo" ? 1 : 0.98,
            }}
            exit={{ opacity: 0, filter: "blur(8px)", scale: 1.02 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center">
              <p
                className="font-mono text-[10px] tracking-[0.32em] uppercase mb-4"
                style={{ color: ACCENT }}
              >
                Markthal
              </p>
              <h1
                className="font-display text-[64px] leading-none tracking-tight"
                style={{
                  color: INK,
                  // Subtiele cyan-rim, geen heavy glow op licht
                  textShadow: "0 0 0 transparent",
                }}
              >
                HQ
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {fase === "landed" && <LandedMockLight />}
    </main>
  );
}

function GridLines({ fase }: { fase: "chaos" | "convergeer" | "logo" | "landed" }) {
  const vLines = 7;
  const hLines = 6;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: fase === "landed" ? 0.35 : 1 }}
    >
      <defs>
        <linearGradient id="centerGlowLight" x1="50%" y1="50%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={ACCENT_BRIGHT} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ACCENT_BRIGHT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: vLines * 2 + 1 }).map((_, i) => {
        const offsetFromCenter = Math.abs(i - vLines);
        const delay = 0.3 + offsetFromCenter * 0.05;
        const xPercent = 50 + ((i - vLines) * 100) / (vLines * 2.4);
        return (
          <motion.line
            key={`v${i}`}
            x1={`${xPercent}%`}
            x2={`${xPercent}%`}
            y1="0%"
            y2="100%"
            stroke={INK}
            strokeWidth={0.5}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "landed" ? 0.04 : [0, 0.14, 0.08],
            }}
            transition={{ duration: 0.7, delay, ease: "easeOut" }}
          />
        );
      })}

      {Array.from({ length: hLines * 2 + 1 }).map((_, i) => {
        const offsetFromCenter = Math.abs(i - hLines);
        const delay = 0.4 + offsetFromCenter * 0.05;
        const yPercent = 50 + ((i - hLines) * 100) / (hLines * 2.4);
        return (
          <motion.line
            key={`h${i}`}
            x1="0%"
            x2="100%"
            y1={`${yPercent}%`}
            y2={`${yPercent}%`}
            stroke={INK}
            strokeWidth={0.5}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "landed" ? 0.035 : [0, 0.12, 0.07],
            }}
            transition={{ duration: 0.7, delay, ease: "easeOut" }}
          />
        );
      })}

      {fase === "landed" && (
        <motion.circle
          cx="50%"
          cy="42%"
          r="240"
          fill="url(#centerGlowLight)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.65, 0.4], scale: [1, 1.04, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
