"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";

interface KlokEvent {
  id: number;
  type: "in" | "out";
  tijdstempel: string;
  handmatig: boolean;
}

interface State {
  ingeklokt: boolean;
  laatste: { type: "in" | "out"; tijdstempel: string } | null;
  historie: KlokEvent[];
}

function fmtTijd(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

function fmtDatum(iso: string, vandaagIso: string): string {
  const d = new Date(iso);
  const datumStr = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
  if (datumStr === vandaagIso) return "Vandaag";
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric", month: "short",
  }).format(d);
}

function duurSinds(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const uur = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  if (uur > 0) return `${uur}u ${min}m`;
  return `${min}m`;
}

export default function MedewerkerKlok() {
  const { t } = useTaal();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy]   = useState(false);
  const [fout, setFout]   = useState<string | null>(null);
  const [nu, setNu]       = useState(new Date());

  async function laden() {
    try {
      const res = await fetch("/api/medewerker/klok", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      // stil
    }
  }

  useEffect(() => {
    laden();
    const id = setInterval(() => setNu(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function klok(type: "in" | "out") {
    setBusy(true);
    setFout(null);
    try {
      // Vraag locatie als beschikbaar (niet blokkerend)
      const loc: { latitude?: number; longitude?: number } = await new Promise((resolve) => {
        if (!("geolocation" in navigator)) return resolve({});
        const timeout = setTimeout(() => resolve({}), 3000);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeout);
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          },
          () => { clearTimeout(timeout); resolve({}); },
          { enableHighAccuracy: false, timeout: 3000 },
        );
      });

      const res = await fetch("/api/medewerker/klok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...loc }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "Klokken mislukt");
      }
      await laden();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center pt-12">
        <div
          className="w-6 h-6 rounded-full animate-spin"
          style={{ border: "2px solid var(--hairline)", borderTopColor: "var(--text-2)" }}
        />
      </div>
    );
  }

  const vandaagIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(nu);

  return (
    <div className="space-y-4">
      {/* Status card — sci-fi treatment: pulserende glow-ring, grote
          monospace time-display, status als cap-tracking caption */}
      <div
        className="relative rounded-sf-lg text-center py-10 px-6 overflow-hidden"
        style={{
          background: state.ingeklokt ? "rgba(0, 255, 148, 0.04)" : "var(--bg-elev)",
          border: `1px solid ${state.ingeklokt ? "rgba(0, 255, 148, 0.35)" : "var(--hairline)"}`,
          boxShadow: state.ingeklokt
            ? "0 0 32px rgba(0, 255, 148, 0.20), inset 0 0 24px rgba(0, 255, 148, 0.04)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Pulserende ring achter de cijfers — alleen ingeklokt */}
        {state.ingeklokt && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pulse-soft"
            style={{
              width: 220,
              height: 220,
              background: "radial-gradient(circle, rgba(0, 255, 148, 0.12) 0%, transparent 70%)",
              filter: "blur(2px)",
            }}
          />
        )}

        <div className="relative">
          <p
            className="font-mono text-[11px] tracking-[0.20em] uppercase mb-3"
            style={{ color: state.ingeklokt ? "var(--sf-success)" : "var(--muted)" }}
          >
            {state.ingeklokt ? t("clock.in_status") : t("clock.out_status")}
          </p>
          {state.laatste && (
            <>
              <p
                className="font-display tabular-nums leading-none"
                style={{
                  color: "var(--text)",
                  fontSize: state.ingeklokt ? "52px" : "44px",
                  letterSpacing: "-0.025em",
                  textShadow: state.ingeklokt ? "0 0 28px rgba(0, 255, 148, 0.35)" : undefined,
                }}
              >
                {state.ingeklokt ? duurSinds(state.laatste.tijdstempel) : fmtTijd(state.laatste.tijdstempel)}
              </p>
              <p className="font-mono text-[12px] mt-3" style={{ color: "var(--muted)" }}>
                {state.ingeklokt
                  ? `${t("clock.in_at")} ${fmtTijd(state.laatste.tijdstempel)}`
                  : `${t("clock.last_action_out_at")} ${fmtTijd(state.laatste.tijdstempel)}`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Action-knop — groot, glow per state, scale on press */}
      <button
        onClick={() => klok(state.ingeklokt ? "out" : "in")}
        disabled={busy}
        className="w-full py-6 rounded-sf-lg font-display text-[18px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 active:scale-[0.98]"
        style={{
          background: state.ingeklokt
            ? "linear-gradient(180deg, #FF5266 0%, #E5384E 100%)"
            : "linear-gradient(180deg, #00E5A8 0%, #00C18A 100%)",
          boxShadow: busy
            ? "none"
            : state.ingeklokt
            ? "0 0 32px rgba(255, 61, 92, 0.45), 0 8px 24px rgba(255, 61, 92, 0.25), inset 0 1px 0 rgba(255,255,255,0.20)"
            : "0 0 32px rgba(0, 255, 148, 0.40), 0 8px 24px rgba(0, 200, 130, 0.25), inset 0 1px 0 rgba(255,255,255,0.20)",
          letterSpacing: "0.005em",
          minHeight: 80,
        }}
      >
        <Icon name="clock" size={22} strokeWidth={2} />
        {state.ingeklokt ? t("clock.out") : t("clock.in")}
      </button>

      {fout && (
        <p className="text-center font-mono text-[13px]" style={{ color: "var(--sf-danger)" }}>{fout}</p>
      )}

      {/* Historie */}
      {state.historie.length > 0 && (
        <div className="card">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase mb-3" style={{ color: "var(--sf-accent)" }}>{t("clock.recent")}</p>
          <div className="space-y-1.5">
            {state.historie.slice(0, 10).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between text-[13px] py-1"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      background: e.type === "in" ? "var(--sf-success)" : "var(--muted)",
                      boxShadow: e.type === "in" ? "0 0 6px rgba(0, 255, 148, 0.6)" : "none",
                    }}
                  />
                  <span className="font-display" style={{ color: "var(--text)" }}>
                    {e.type === "in" ? t("clock.in_status") : t("clock.out_past")}
                  </span>
                  {e.handmatig && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: "var(--hairline)", color: "var(--muted)" }}>
                      {t("clock.manual")}
                    </span>
                  )}
                </span>
                <span className="font-mono tabular-nums" style={{ color: "var(--muted)" }}>
                  {fmtDatum(e.tijdstempel, vandaagIso)} · {fmtTijd(e.tijdstempel)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
