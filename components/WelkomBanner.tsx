"use client";

import { useEffect, useState } from "react";

/**
 * Korte sobere welkomstmelding na inloggen. Geen sierschrift meer —
 * SF-stijl typografie met subtiele fade-in. Verschijnt 1x per sessie via
 * PinGate (event `sg:welkom` of `sg_welkom_pending` flag).
 */
export default function WelkomBanner() {
  const [naam, setNaam] = useState<string | null>(null);
  const [fase, setFase] = useState<"in" | "uit">("in");

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function toon(welkomVoor: string) {
      setNaam(welkomVoor);
      setFase("in");
      if (fadeTimer) clearTimeout(fadeTimer);
      if (hideTimer) clearTimeout(hideTimer);
      fadeTimer = setTimeout(() => setFase("uit"), 2200);
      hideTimer = setTimeout(() => setNaam(null), 3200);
    }

    const pending = sessionStorage.getItem("sg_welkom_pending");
    if (pending) {
      sessionStorage.removeItem("sg_welkom_pending");
      toon(pending);
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ naam: string }>).detail;
      if (!detail?.naam) return;
      sessionStorage.removeItem("sg_welkom_pending");
      toon(detail.naam);
    };
    window.addEventListener("sg:welkom", handler);

    return () => {
      window.removeEventListener("sg:welkom", handler);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!naam) return null;

  const uur = new Date().getHours();
  const groet = uur < 6 ? "Goedenacht" : uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-700 ${
        fase === "in" ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-[var(--bg)]/70 backdrop-blur-xl" />
      <div className="relative text-center fade-up">
        <p
          className="text-[28px] sm:text-[34px] font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.022em" }}
        >
          {groet}, {naam}
        </p>
      </div>
    </div>
  );
}
