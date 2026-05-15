"use client";

/**
 * Variant 02 — Particle Constellation
 *
 * Beat-sheet:
 *   0-700   — 200 deeltjes drijven chaotisch (random velocities)
 *   700-1300 — deeltjes converteren naar hex/cirkel-patroon (lerp naar target)
 *   1300+   — logo emerges from center; particles blijven driften en
 *            zwakjes reageren op cursor
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
}

const PARTICLE_COUNT = 200;

export default function BootParticleConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<"chaos" | "convergeer" | "landed">("chaos");
  const mouseRef = useRef({ x: -1, y: -1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;

    // Initieer deeltjes met chaos-velocities + cirkel-target
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      // Verschillende ringen — innerlijke compact, buitenlijk verspreid
      const ring = i % 3;
      const radius = 80 + ring * 50 + Math.random() * 15;
      return {
        x: cx + (Math.random() - 0.5) * w * 1.2,
        y: cy + (Math.random() - 0.5) * h * 1.2,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        targetX: cx + Math.cos(angle) * radius,
        targetY: cy + Math.sin(angle) * radius,
        size: 0.8 + Math.random() * 1.4,
        alpha: 0.4 + Math.random() * 0.6,
      };
    });

    let rafId = 0;
    let startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, w, h);

      // Fase-bepaling
      const inConverge = elapsed > 700;
      const isLanded = elapsed > 1300;

      for (const p of particles) {
        if (isLanded) {
          // Ambient: zachte drift rond target, mouse-reactief
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          p.vx += dx * 0.002;
          p.vy += dy * 0.002;
          p.vx *= 0.96;
          p.vy *= 0.96;
          // Mouse repel
          const mdx = p.x - mouseRef.current.x;
          const mdy = p.y - mouseRef.current.y;
          const mDist = Math.hypot(mdx, mdy);
          if (mDist < 100 && mDist > 0) {
            p.vx += (mdx / mDist) * 0.4;
            p.vy += (mdy / mDist) * 0.4;
          }
        } else if (inConverge) {
          // Convergeer naar target met spring-achtige lerp
          p.vx += (p.targetX - p.x) * 0.015;
          p.vy += (p.targetY - p.y) * 0.015;
          p.vx *= 0.88;
          p.vy *= 0.88;
        }
        // Anders: chaos-velocities blijven gewoon ronddrijven

        p.x += p.vx;
        p.y += p.vy;

        // Teken — cyan met glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Fase-state voor de logo-overlay
    const t1 = setTimeout(() => setFase("convergeer"), 700);
    const t2 = setTimeout(() => setFase("landed"), 1400);

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
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ background: "var(--sf-bg)" }}
      />

      <AnimatePresence>
        {fase !== "landed" && (
          <motion.div
            key="logo"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, filter: "blur(12px)" }}
            animate={{ opacity: fase === "convergeer" ? 1 : 0.2, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center">
              <p
                className="font-mono text-[10px] tracking-[0.3em] uppercase mb-4"
                style={{ color: "var(--sf-accent)", opacity: 0.7 }}
              >
                Aligning systems
              </p>
              <h1
                className="font-display text-[56px] leading-none tracking-tight"
                style={{
                  color: "var(--sf-fg)",
                  textShadow: "0 0 32px var(--sf-accent-glow)",
                }}
              >
                Markthal HQ
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {fase === "landed" && <LandedMock />}
    </main>
  );
}
