"use client";

import { useEffect, useState } from "react";

export default function WelkomBanner() {
  const [naam, setNaam] = useState<string | null>(null);
  const [zichtbaar, setZichtbaar] = useState(false);

  useEffect(() => {
    const opgeslagen = sessionStorage.getItem("sg_user");
    if (opgeslagen) {
      setNaam(opgeslagen);
      setZichtbaar(true);
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ naam: string }>).detail;
      if (detail?.naam) {
        setNaam(detail.naam);
        setZichtbaar(true);
      }
    };
    window.addEventListener("sg:welkom", handler);
    return () => window.removeEventListener("sg:welkom", handler);
  }, []);

  // Fade uit na 4s
  useEffect(() => {
    if (!zichtbaar) return;
    const t = setTimeout(() => setZichtbaar(false), 4000);
    return () => clearTimeout(t);
  }, [zichtbaar, naam]);

  if (!naam) return null;

  return (
    <>
      {/* Persistente kleine naam-chip rechtsboven in de header */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 shrink-0">
        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold">
          {naam.slice(0, 1)}
        </div>
        <span>Welkom {naam}</span>
      </div>

      {/* Tijdelijke toast */}
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
          zichtbaar
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-white border border-slate-200 shadow-card rounded-full px-5 py-2.5 flex items-center gap-3">
          <span className="text-xl">👋</span>
          <span className="text-sm font-semibold text-slate-900">
            Welkom {naam}
          </span>
        </div>
      </div>
    </>
  );
}
