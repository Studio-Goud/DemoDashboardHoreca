"use client";

import { useEffect, useState } from "react";

/**
 * Toont 1x per login een grote, in sierletters geschreven "Welkom {naam}".
 *
 * Verschijnt ALLEEN via het sg:welkom event dat PinGate dispatched op
 * het moment van succesvol inloggen. Niet bij refresh, niet bij tab-
 * wissel. Na 3.5s volledig zichtbaar → zacht fade-out over 1s.
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
      fadeTimer = setTimeout(() => setFase("uit"), 3500);
      hideTimer = setTimeout(() => setNaam(null), 4500);
    }

    // Check pending-flag die PinGate net heeft gezet (vangt de mount-race)
    const pending = sessionStorage.getItem("sg_welkom_pending");
    if (pending) {
      sessionStorage.removeItem("sg_welkom_pending");
      toon(pending);
    }

    // Event-listener voor het geval PinGate na mount triggert
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

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${
        fase === "in" ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm" />
      <div className="relative text-center">
        <p className="text-slate-500 text-sm uppercase tracking-[0.35em] mb-3">
          Welkom
        </p>
        <p
          className="text-7xl sm:text-8xl text-slate-900"
          style={{ fontFamily: "var(--font-script), cursive" }}
        >
          {naam}
        </p>
      </div>
    </div>
  );
}
