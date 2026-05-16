"use client";

/**
 * Speelse intro op de verjaardag van de medewerker. Wordt eenmalig per dag
 * getoond — daarna onthouden we in localStorage dat de viering al gezien is
 * (key bevat de datum, dus volgend jaar speelt 'ie weer).
 *
 * Componenten:
 *   - Confetti + vuurwerk via canvas (geen externe lib — eigen particle-systeem
 *     houdt de bundle klein en stylebaar).
 *   - Happy Birthday-melodie via Web Audio API — geen mp3-assets nodig.
 *   - "Sluiten / Niet nu" knop zodat 't ook in stilte kan.
 *
 * Aanroep:
 *   <VerjaardagsViering voornaam={..} geboortedatum={"YYYY-MM-DD"} />
 *
 * Geboortedatum mag null zijn — dan rendert 't component niks.
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  voornaam: string;
  /** ISO datum "YYYY-MM-DD" of null. */
  geboortedatum: string | null;
  /** "YYYY-MM-DD" van vandaag in Europe/Amsterdam — server-bepaald. */
  vandaag: string;
}

const STORAGE_KEY_PREFIX = "sg_verjaardag_gezien_";

function isVerjaardagVandaag(geboortedatum: string, vandaag: string): boolean {
  // Geboortedatum kan zijn "1995-05-16" — we matchen op MM-DD.
  const gb = geboortedatum.slice(5, 10); // "05-16"
  const td = vandaag.slice(5, 10);
  return gb === td;
}

export default function VerjaardagsViering({ voornaam, geboortedatum, vandaag }: Props) {
  const [actief, setActief] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<{ ctx: AudioContext | null; stop: () => void } | null>(null);

  useEffect(() => {
    if (!geboortedatum) return;
    if (!isVerjaardagVandaag(geboortedatum, vandaag)) return;
    const key = `${STORAGE_KEY_PREFIX}${vandaag}`;
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
    setActief(true);
  }, [geboortedatum, vandaag]);

  useEffect(() => {
    if (!actief) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const animatie = startAnimatie(canvas);
    audioRef.current = startMuziek();
    return () => {
      animatie.stop();
      audioRef.current?.stop();
    };
  }, [actief]);

  if (!actief) return null;

  function sluit() {
    audioRef.current?.stop();
    setActief(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <div className="relative z-10 text-center max-w-md">
        <p className="text-[14px] mb-3" style={{ color: "#FFD166", letterSpacing: "0.1em" }}>
          ✨  GEFELICITEERD  ✨
        </p>
        <h1
          className="text-[40px] sm:text-[56px] font-bold leading-tight mb-3"
          style={{
            background: "linear-gradient(90deg, #FF6FB5 0%, #FFD166 50%, #6EE7B7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          Happy Birthday<br />{voornaam}!
        </h1>
        <p className="text-[15px] mb-8 max-w-sm mx-auto" style={{ color: "#fff" }}>
          Het hele team van Markthal HQ wenst je een fantastische dag. 🎂🎈
        </p>
        <button
          onClick={sluit}
          className="px-6 py-3 rounded-full text-[14px] font-semibold"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          Dankjewel! ✨
        </button>
      </div>
    </div>
  );
}

// ─── Confetti + vuurwerk animatie ────────────────────────────────────────────

interface Deeltje {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kleur: string;
  grootte: number;
  rotatie: number;
  vrotatie: number;
  leeftijd: number;
  ttl: number;
  type: "confetti" | "vonk";
}

const KLEUREN = ["#FF6FB5", "#FFD166", "#6EE7B7", "#60A5FA", "#A78BFA", "#FB7185", "#34D399"];

function startAnimatie(canvas: HTMLCanvasElement): { stop: () => void } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop: () => {} };

  function aanpassen() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx!.scale(dpr, dpr);
  }
  aanpassen();
  window.addEventListener("resize", aanpassen);

  const deeltjes: Deeltje[] = [];
  const w = () => window.innerWidth;
  const h = () => window.innerHeight;

  function spawnConfettiBatch() {
    for (let i = 0; i < 60; i++) {
      deeltjes.push({
        x: Math.random() * w(),
        y: -20,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        kleur: KLEUREN[Math.floor(Math.random() * KLEUREN.length)],
        grootte: 6 + Math.random() * 6,
        rotatie: Math.random() * Math.PI * 2,
        vrotatie: (Math.random() - 0.5) * 0.3,
        leeftijd: 0,
        ttl: 240 + Math.random() * 120,
        type: "confetti",
      });
    }
  }

  function spawnVuurwerk(cx: number, cy: number) {
    const stuks = 28;
    const kleur = KLEUREN[Math.floor(Math.random() * KLEUREN.length)];
    for (let i = 0; i < stuks; i++) {
      const hoek = (Math.PI * 2 * i) / stuks;
      const snelheid = 4 + Math.random() * 3;
      deeltjes.push({
        x: cx,
        y: cy,
        vx: Math.cos(hoek) * snelheid,
        vy: Math.sin(hoek) * snelheid,
        kleur,
        grootte: 3,
        rotatie: 0,
        vrotatie: 0,
        leeftijd: 0,
        ttl: 60 + Math.random() * 30,
        type: "vonk",
      });
    }
  }

  spawnConfettiBatch();
  const confettiInterval = window.setInterval(spawnConfettiBatch, 1200);
  const vuurwerkInterval = window.setInterval(() => {
    spawnVuurwerk(
      w() * (0.15 + Math.random() * 0.7),
      h() * (0.2 + Math.random() * 0.3),
    );
  }, 700);

  let raf = 0;
  function frame() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = deeltjes.length - 1; i >= 0; i--) {
      const p = deeltjes[i];
      p.leeftijd++;
      if (p.leeftijd > p.ttl || p.y > h() + 50) {
        deeltjes.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === "confetti") {
        p.vy += 0.08; // zwaartekracht
        p.vx *= 0.995;
        p.rotatie += p.vrotatie;
      } else {
        p.vy += 0.06;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      const alpha = p.type === "vonk"
        ? Math.max(0, 1 - p.leeftijd / p.ttl)
        : 1;
      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rotatie);
      ctx!.fillStyle = p.kleur;
      if (p.type === "confetti") {
        ctx!.fillRect(-p.grootte / 2, -p.grootte / 4, p.grootte, p.grootte / 2);
      } else {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.grootte, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
    }
    raf = requestAnimationFrame(frame);
  }
  frame();

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      clearInterval(confettiInterval);
      clearInterval(vuurwerkInterval);
      window.removeEventListener("resize", aanpassen);
    },
  };
}

// ─── Happy Birthday-melodie via Web Audio ────────────────────────────────────

function startMuziek(): { ctx: AudioContext | null; stop: () => void } {
  const AC = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AC) return { ctx: null, stop: () => {} };
  const ctx = new AC();

  // Noten (frequentie in Hz) en duraties (seconden) — klassiek Happy Birthday
  // in C-majeur. Eerste noten "Happy Birth-day to you".
  type N = readonly [number, number];
  const C  = 261.63, D = 293.66, E = 329.63, F = 349.23, G = 392.00, A = 440.00, BFlat = 466.16;
  const k = 0.4; // basis-duur in sec
  const noten: N[] = [
    [G, k * 0.75], [G, k * 0.25], [A, k],     [G, k],     [C * 2, k], [BFlat, k * 2],
    [G, k * 0.75], [G, k * 0.25], [A, k],     [G, k],     [D * 2, k], [C * 2, k * 2],
    [G, k * 0.75], [G, k * 0.25], [G * 2, k], [E * 2, k], [C * 2, k], [BFlat, k], [A, k * 2],
    [F * 2, k * 0.75], [F * 2, k * 0.25], [E * 2, k], [C * 2, k], [D * 2, k], [C * 2, k * 2],
  ];

  let t = ctx.currentTime + 0.2;
  const stoppers: Array<() => void> = [];
  for (const [freq, duur] of noten) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    // Attack/release envelope om "klikjes" te vermijden
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.setValueAtTime(0.18, t + duur - 0.05);
    gain.gain.linearRampToValueAtTime(0, t + duur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duur);
    stoppers.push(() => { try { osc.stop(); } catch { /* al gestopt */ } });
    t += duur;
  }

  return {
    ctx,
    stop: () => {
      stoppers.forEach((s) => s());
      ctx.close().catch(() => null);
    },
  };
}
