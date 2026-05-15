"use client";

/**
 * Persoonlijke QR-pagina voor medewerker. Toont QR + live-counter die
 * elke 5s polled. Bij +1 vibreert telefoon (indien ondersteund) + groene
 * pulse-animatie. Motiverend: zie direct dat je scan werkt.
 */
import { useEffect, useRef, useState } from "react";
import { Heart, Star, Share2 } from "lucide-react";

interface Props {
  voornaam: string;
  datum: string;
  url: string;
  qrSvg: string;
}

interface ClickInfo {
  scans: number;
  klikken: number;
  laatste: { status: string; geregistreerdOp: string } | null;
}

export default function MijnQRWidget({ voornaam, datum, url, qrSvg }: Props) {
  const [info, setInfo] = useState<ClickInfo>({ scans: 0, klikken: 0, laatste: null });
  const [pulse, setPulse] = useState(false);
  const laatsteIdRef = useRef<string | null>(null);

  useEffect(() => {
    let actief = true;

    async function pol() {
      if (!actief) return;
      // Skip polling als de tab niet zichtbaar is — bespaart enorm veel
      // DB-transfer voor medewerkers die de pagina open laten in een
      // achtergrond-tab.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/m/mijn-vandaag", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!actief) return;
        const key = d.laatste?.geregistreerdOp ?? null;
        if (key && key !== laatsteIdRef.current && laatsteIdRef.current !== null) {
          // Nieuwe activity sinds vorige poll → trigger feedback
          setPulse(true);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try { navigator.vibrate(60); } catch { /* iOS no-op */ }
          }
          setTimeout(() => setPulse(false), 1200);
        }
        laatsteIdRef.current = key;
        setInfo(d);
      } catch { /* stil */ }
    }

    pol();
    // 30s polling i.p.v. 5s — bespaart ~83% queries terwijl de gebruiker
    // nog steeds binnen 30 sec ziet dat 'r een review binnen is.
    const iv = setInterval(pol, 30_000);
    // Direct ververs bij focus/visibility-change zodat 't toch reactief
    // voelt zonder constant te pollen.
    const onVisible = () => { if (!document.hidden) pol(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      actief = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  async function deel() {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Review-link", text: `Help ${voornaam} aan een review`, url });
        return;
      } catch { /* user cancelled */ }
    }
    if (nav.clipboard && typeof nav.clipboard.writeText === "function") {
      try { await nav.clipboard.writeText(url); } catch { /* stil */ }
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-mono text-[10px] tracking-[0.32em] uppercase mb-1" style={{ color: "var(--sf-accent, #00E5FF)" }}>
          Mijn review-QR
        </p>
        <h1 className="font-display text-[22px] font-semibold tracking-tight" style={{ color: "var(--text, #E8ECF4)" }}>
          Vandaag · {datum}
        </h1>
      </div>

      <div
        className="bg-white p-5 rounded-2xl mx-auto"
        style={{
          maxWidth: 320,
          boxShadow: pulse
            ? "0 0 0 4px rgba(0,229,255,0.5), 0 0 32px rgba(0,229,255,0.3)"
            : "0 6px 30px rgba(0,0,0,0.3)",
          transition: "box-shadow 0.6s ease-out",
        }}
      >
        <p className="font-mono text-[9px] tracking-[0.32em] uppercase text-center mb-3" style={{ color: "#555" }}>
          Bedankt voor je bezoek
        </p>
        <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="mx-auto" style={{ maxWidth: 260 }} />
        <p className="font-mono text-[10px] text-center mt-2" style={{ color: "#666" }}>
          Scan & review {voornaam} · 30 sec
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto w-full">
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Share2 size={11} style={{ color: "var(--muted)" }} />
            <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Scans
            </p>
          </div>
          <p
            className="font-display font-semibold tabular-nums"
            style={{ color: "var(--text)", fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            {info.scans}
          </p>
        </div>
        <div
          className="card text-center"
          style={{
            background: pulse ? "rgba(0,229,255,0.1)" : undefined,
            transition: "background 0.6s ease-out",
          }}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Heart
              size={11}
              fill={info.klikken > 0 ? "var(--sf-accent, #00E5FF)" : "transparent"}
              stroke={info.klikken > 0 ? "var(--sf-accent, #00E5FF)" : "var(--muted)"}
            />
            <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Reviews onderweg
            </p>
          </div>
          <p
            className="font-display font-semibold tabular-nums"
            style={{ color: "var(--sf-accent, #00E5FF)", fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            {info.klikken}
          </p>
        </div>
      </div>

      <div className="max-w-sm mx-auto w-full">
        <button
          type="button"
          onClick={deel}
          className="w-full py-3 rounded-lg font-mono text-[11px] uppercase tracking-wider flex items-center justify-center gap-2"
          style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", color: "var(--text)", minHeight: 44 }}
        >
          <Share2 size={14} /> Deel link
        </button>
        <p className="font-mono text-[9px] mt-2 break-all text-center" style={{ color: "var(--muted)" }}>
          {url}
        </p>
      </div>

      <div className="max-w-sm mx-auto w-full">
        <div className="card text-[12px] flex items-start gap-2" style={{ color: "var(--muted)" }}>
          <Star size={14} className="shrink-0 mt-0.5" style={{ color: "var(--sf-accent, #00E5FF)" }} />
          <p>
            Laat dit scherm zien aan tafel. Wanneer een klant scant en doorklikt zie
            je hier direct +1. De QR vervalt morgen automatisch.
          </p>
        </div>
      </div>
    </div>
  );
}
