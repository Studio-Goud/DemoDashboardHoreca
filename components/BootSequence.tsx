"use client";

/**
 * App-boot sequence overlay — speelt elke keer dat de app fresh laadt
 * (hard refresh / nieuwe tab / cold open). Soft-navigation triggert
 * 'm NIET — children mount maar 1x.
 *
 * Identiek aan /dev/boot-4 (Synthesis · DARK) qua ritme: particles
 * tekenen een 6×5 grid in, scan-sweep, logo blur-in. Daarna fade-out
 * over 500ms zodat de echte UI eronder onthuld wordt.
 *
 * Skipt voor /dev/*, /m/*, /welkom* via path-check.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  size: number;
  alpha: number;
}

const PARTICLES_PER_INTERSECTION = 4;

// Beat-sheet
const T_CONVERGEER = 500;
const T_LOGO       = 1100;
const T_FADE       = 1700;
const T_DONE       = 2200; // fade-out 500ms

export default function BootSequence() {
  const pathname = usePathname() ?? "";
  // Skip op routes met eigen auth/UX: dev-demos, medewerker-portaal,
  // invite-link landing.
  const skipBoot =
    pathname.startsWith("/dev") ||
    pathname.startsWith("/m") ||
    pathname.startsWith("/welkom");

  const [fase, setFase] = useState<"chaos" | "convergeer" | "logo" | "fading" | "done">(
    skipBoot ? "done" : "chaos",
  );

  useEffect(() => {
    if (skipBoot) return;
    const t1 = setTimeout(() => setFase("convergeer"), T_CONVERGEER);
    const t2 = setTimeout(() => setFase("logo"), T_LOGO);
    const t3 = setTimeout(() => setFase("fading"), T_FADE);
    const t4 = setTimeout(() => setFase("done"), T_DONE);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [skipBoot]);

  if (fase === "done") return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: fase === "fading" ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-hidden
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(0,229,255,0.08), transparent 60%), linear-gradient(180deg, #0E1118 0%, #060810 60%, #04060A 100%)",
      }}
    >
      <GridLines fase={fase} />
      <ParticleCanvas />
      <ScanSweep fase={fase} />

      <AnimatePresence>
        {(fase === "logo" || fase === "convergeer") && (
          <motion.div
            key="logo"
            className="absolute inset-0 flex items-center justify-center"
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
    </motion.div>
  );
}

// ─── Particle canvas ─────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const gridCols = 6;
    const gridRows = 5;
    const spX = Math.min(110, w / (gridCols + 1));
    const spY = Math.min(110, h / (gridRows + 1));
    const startX = cx - ((gridCols - 1) / 2) * spX;
    const startY = cy - ((gridRows - 1) / 2) * spY;

    const intersections: Array<{ x: number; y: number }> = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        intersections.push({ x: startX + c * spX, y: startY + r * spY });
      }
    }

    const particles: Particle[] = [];
    for (const ip of intersections) {
      const distCenter = Math.hypot(ip.x - cx, ip.y - cy);
      const weight = Math.max(1, Math.round(PARTICLES_PER_INTERSECTION - distCenter / 200));
      for (let k = 0; k < weight; k++) {
        const angle = Math.random() * Math.PI * 2;
        const startDist = 200 + Math.random() * Math.max(w, h);
        particles.push({
          x: ip.x + Math.cos(angle) * startDist,
          y: ip.y + Math.sin(angle) * startDist,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          targetX: ip.x,
          targetY: ip.y,
          size: 0.9 + Math.random() * 1.3,
          alpha: 0.5 + Math.random() * 0.5,
        });
      }
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed > T_DONE) {
        cancelAnimationFrame(rafId);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      const inConverge = elapsed > 500;

      for (const p of particles) {
        if (inConverge) {
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

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

// ─── Grid lines ──────────────────────────────────────────────────────

function GridLines({ fase }: { fase: "chaos" | "convergeer" | "logo" | "fading" | "done" }) {
  const vLines = 7;
  const hLines = 6;

  return (
    <svg className="absolute inset-0 w-full h-full">
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
              opacity: fase === "fading" ? 0 : fase === "chaos" ? 0 : [0, 0.22, 0.14],
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
            stroke="var(--sf-accent)"
            strokeWidth={0.6}
            initial={{ opacity: 0 }}
            animate={{
              opacity: fase === "fading" ? 0 : fase === "chaos" ? 0 : [0, 0.2, 0.12],
            }}
            transition={{ duration: 0.7, delay, ease: "easeOut" }}
          />
        );
      })}
    </svg>
  );
}

// ─── Horizontale scan-sweep ──────────────────────────────────────────

function ScanSweep({ fase }: { fase: "chaos" | "convergeer" | "logo" | "fading" | "done" }) {
  if (fase === "chaos" || fase === "done") return null;
  return (
    <motion.div
      className="absolute inset-x-0 z-20"
      initial={{ top: "-2px", opacity: 0 }}
      animate={{ top: ["-2px", "100%"], opacity: [0, 1, 1, 0] }}
      transition={{
        duration: 1.0,
        delay: 0.2,
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
  );
}
