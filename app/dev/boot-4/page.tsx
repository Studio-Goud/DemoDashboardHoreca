"use client";

/**
 * Variant 04 — Synthesis (1 + 2 gecombineerd)
 *
 * Concept: deeltjes drijven chaotisch, schieten samen tot de
 * intersection-points van een grid, en de gridlijnen tekenen zich
 * tegelijkertijd in. Scan-sweep sluit het ritueel af, daarna logo.
 *
 * Beat-sheet:
 *   0-600    — particles drift chaotisch (lichte, langzamere chaos)
 *   400-1000 — gridlijnen fade-in radially vanuit centrum
 *   600-1300 — particles snap-converteren naar grid-intersections
 *   900-1400 — scan-sweep van top naar bottom
 *   1100-1600— logo blur-in
 *   1600+    — landed: particles driften subtiel rond hun intersection,
 *              grid blijft op lage opacity met center-breath, mouse-reactief
 *
 * Lichter-tweak: subtiele top-radial cyan haze + verticale gradient zodat
 * de inkt niet plat zwart aanvoelt.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LandedMock from "@/components/dev/LandedMock";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  size: number;
  alpha: number;
  orbitPhase: number; // voor ambient drift na landing
}

const PARTICLES_PER_INTERSECTION = 4;

export default function BootSynthesis() {
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

    // Grid intersections — 6×5 punten gecentreerd in scherm.
    // Particles convergeren hier naartoe.
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

    // Verdeel particles over intersection-points; meer dichtbij centrum.
    const particles: Particle[] = [];
    for (const ipoint of intersections) {
      // Punten dichterbij centrum krijgen meer particles voor zwaartepunt
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
          size: 0.9 + Math.random() * 1.3,
          alpha: 0.5 + Math.random() * 0.5,
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

      // Update fase-state voor de React-overlays (alleen op transitions)
      // — we doen dit hier via refs zodat we niet elke frame setState'en.
      // (De useState gebeurt in setTimeout's hieronder.)

      for (const p of particles) {
        if (isLanded) {
          // Ambient: orbit rond target met traag oscillerende positie +
          // mouse-repel.
          p.orbitPhase += 0.008;
          const orbitX = p.targetX + Math.cos(p.orbitPhase) * 4;
          const orbitY = p.targetY + Math.sin(p.orbitPhase * 0.7) * 4;
          const dx = orbitX - p.x;
          const dy = orbitY - p.y;
          p.vx += dx * 0.04;
          p.vy += dy * 0.04;
          p.vx *= 0.85;
          p.vy *= 0.85;
          // Mouse repel
          const mdx = p.x - mouseRef.current.x;
          const mdy = p.y - mouseRef.current.y;
          const mDist = Math.hypot(mdx, mdy);
          if (mDist < 120 && mDist > 0) {
            const force = (1 - mDist / 120) * 0.8;
            p.vx += (mdx / mDist) * force;
            p.vy += (mdy / mDist) * force;
          }
        } else if (inConverge) {
          // Snel convergeren — sterkere spring dan in boot-2 zodat 'ie
          // op tijd "klikt" naar het grid.
          p.vx += (p.targetX - p.x) * 0.022;
          p.vy += (p.targetY - p.y) * 0.022;
          p.vx *= 0.86;
          p.vy *= 0.86;
        }

        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${p.alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(0, 229, 255, 0.85)";
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Fase-state voor de overlays
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
        // Atmosferische lift: subtiele top-cyan haze + verticale gradient
        // zodat het niet plat zwart aanvoelt. Onder een drempel blijft 'ie
        // donker genoeg voor de cinematic feel.
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(0,229,255,0.08), transparent 60%), linear-gradient(180deg, #0E1118 0%, #060810 60%, #04060A 100%)",
      }}
    >
      {/* SVG grid — fade-in radially vanaf centrum tijdens boot, blijft
          op lage opacity tijdens landed. */}
      <GridLines fase={fase} />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Scan-sweep — alleen tijdens boot. */}
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
              height: 2,
              background:
                "linear-gradient(90deg, transparent, var(--sf-accent) 50%, transparent)",
              boxShadow: "0 0 28px var(--sf-accent), 0 0 6px var(--sf-accent)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Logo */}
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
                style={{ color: "var(--sf-accent)" }}
              >
                Markthal
              </p>
              <h1
                className="font-display text-[64px] leading-none tracking-tight"
                style={{
                  color: "var(--sf-fg)",
                  textShadow:
                    "0 0 32px var(--sf-accent-glow), 0 0 8px rgba(0,229,255,0.6)",
                }}
              >
                HQ
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {fase === "landed" && <LandedMock />}
    </main>
  );
}

/**
 * Grid dat zich opbouwt vanuit centrum tijdens boot. Lijnen lopen door
 * de intersection-points waar particles op landen — visueel een
 * "framework dat zich ontvouwt".
 */
function GridLines({ fase }: { fase: "chaos" | "convergeer" | "logo" | "landed" }) {
  // Aantal lijnen ~ matching de particle-intersections (6×5 grid).
  const vLines = 7; // 1 extra aan elke kant van de 6 cols
  const hLines = 6;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: fase === "landed" ? 0.22 : 1 }}
    >
      <defs>
        <linearGradient id="centerGlow" x1="50%" y1="50%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--sf-accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--sf-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Vertical lines — staggered fade-in vanuit centrum naar buiten. */}
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
            stroke="var(--sf-accent)"
            strokeWidth={0.6}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "landed" ? 0.08 : [0, 0.22, 0.14],
            }}
            transition={{ duration: 0.7, delay, ease: "easeOut" }}
          />
        );
      })}

      {/* Horizontal lines — idem. */}
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
            stroke="var(--sf-accent)"
            strokeWidth={0.6}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "landed" ? 0.07 : [0, 0.2, 0.12],
            }}
            transition={{ duration: 0.7, delay, ease: "easeOut" }}
          />
        );
      })}

      {/* Center breath-glow op landed. */}
      {fase === "landed" && (
        <motion.circle
          cx="50%"
          cy="42%"
          r="240"
          fill="url(#centerGlow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.04, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}
