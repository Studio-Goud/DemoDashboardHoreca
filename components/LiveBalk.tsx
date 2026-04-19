"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

const BEDRIJVEN = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕", kleur: "#00B8FF" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢", kleur: "#00D27A" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟", kleur: "#FF8A00" },
];

interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
}

interface VerwachtData {
  verwachtVandaag: number;
  weekdagCurve: number[];
}

function verwachtTotNu(curve: number[]): number {
  if (!curve || curve.length !== 24) return 0;
  const nu = new Date();
  // Gebruik NL-tijd (Europe/Amsterdam)
  const nlTijd = new Date(nu.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const uur = nlTijd.getHours();
  const minuutFractie = nlTijd.getMinutes() / 60;
  let som = 0;
  for (let i = 0; i < uur; i++) som += curve[i] ?? 0;
  som += (curve[uur] ?? 0) * minuutFractie;
  return Math.round(som * 100) / 100;
}

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BedrijfKolom({
  slug, naam, emoji, kleur,
}: {
  slug: string; naam: string; emoji: string; kleur: string;
}) {
  const [data, setData]           = useState<LiveData | null>(null);
  const [verwacht, setVerwacht]   = useState<VerwachtData | null>(null);
  const [nu, setNu]               = useState(new Date());

  const laadLive = useCallback(async () => {
    try {
      const res  = await fetch(`/api/sumup/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch { /* stil */ }
  }, [slug]);

  const laadVerwacht = useCallback(async () => {
    try {
      const res  = await fetch(`/api/verwacht/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setVerwacht(json);
    } catch { /* stil */ }
  }, [slug]);

  useEffect(() => {
    laadLive();
    laadVerwacht();

    // Live elke 20s, verwacht elke 5 min (is gecached)
    const tLive     = setInterval(laadLive,    20_000);
    const tVerwacht = setInterval(laadVerwacht, 5 * 60_000);
    // Klok elke minuut om indicator te herberekenen
    const tKlok     = setInterval(() => setNu(new Date()), 60_000);

    window.addEventListener("dashboard:refresh", laadLive);
    return () => {
      clearInterval(tLive);
      clearInterval(tVerwacht);
      clearInterval(tKlok);
      window.removeEventListener("dashboard:refresh", laadLive);
    };
  }, [laadLive, laadVerwacht]);

  // Herbereken elke minuut via nu-dep
  const verwachtNu = useMemo(
    () => verwacht ? verwachtTotNu(verwacht.weekdagCurve) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verwacht, nu]
  );

  const omzet       = data?.omzetVandaag ?? 0;
  const klanten     = data?.aantalTransactiesVandaag ?? null;
  // Toon indicator zodra curve geladen is en totaaldag > 0 (niet een lege fallback)
  const heeftSchema = verwacht !== null && (verwacht.verwachtVandaag > 0 || verwacht.weekdagCurve.some(v => v > 0));
  const voorOp      = omzet >= verwachtNu;
  const verschil    = Math.abs(omzet - verwachtNu);

  return (
    <div
      className="flex-1 px-3 sm:px-4 py-2 border-r last:border-r-0"
      style={{ borderColor: "#1e2530" }}
    >
      {/* Bedrijfsnaam */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm leading-none">{emoji}</span>
        <span
          className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] font-mono truncate"
          style={{ color: kleur }}
        >
          {naam}
        </span>
      </div>

      {/* Live omzet */}
      <p
        className="text-sm sm:text-base font-bold font-mono tabular-nums leading-tight"
        style={{ color: "#e2e8f0" }}
      >
        {data ? fmt(omzet) : "€–"}
      </p>

      {/* Schema-indicator + klanten */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-0.5 gap-0.5">
        {heeftSchema ? (
          <span
            className="text-[9px] sm:text-[10px] font-mono font-semibold"
            style={{ color: voorOp ? "#4ade80" : "#f87171" }}
          >
            {voorOp ? "✓" : "✗"} {voorOp ? "+" : "-"}{fmt(verschil)}
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#475569" }}>
            schema laadt…
          </span>
        )}
        {klanten !== null && (
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#64748b" }}>
            {klanten} klanten
          </span>
        )}
      </div>
    </div>
  );
}

export default function LiveBalk() {
  return (
    <div
      className="flex w-full sticky top-0 z-50"
      style={{ background: "#0a0e14", borderBottom: "1px solid #1e2530" }}
    >
      {BEDRIJVEN.map((b) => (
        <BedrijfKolom key={b.slug} {...b} />
      ))}
    </div>
  );
}
