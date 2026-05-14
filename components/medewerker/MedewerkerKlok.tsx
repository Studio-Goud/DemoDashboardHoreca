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
      {/* Status card */}
      <div
        className="card text-center py-8"
        style={{
          background: state.ingeklokt ? "rgba(48,178,111,0.06)" : "var(--bg-elev)",
          borderColor: state.ingeklokt ? "rgba(48,178,111,0.4)" : undefined,
        }}
      >
        <p className="eyebrow mb-1" style={{ color: state.ingeklokt ? "#30B26F" : "var(--muted)" }}>
          {state.ingeklokt ? t("clock.in_status") : t("clock.out_status")}
        </p>
        {state.laatste && (
          <>
            <p className="text-[32px] font-semibold tabular-nums" style={{ color: "var(--text)", letterSpacing: "-0.022em" }}>
              {state.ingeklokt ? duurSinds(state.laatste.tijdstempel) : fmtTijd(state.laatste.tijdstempel)}
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
              {state.ingeklokt
                ? `${t("clock.in_at")} ${fmtTijd(state.laatste.tijdstempel)}`
                : `${t("clock.last_action_out_at")} ${fmtTijd(state.laatste.tijdstempel)}`}
            </p>
          </>
        )}
      </div>

      {/* Knop */}
      <button
        onClick={() => klok(state.ingeklokt ? "out" : "in")}
        disabled={busy}
        className="w-full py-5 rounded-[14px] text-[17px] font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: state.ingeklokt ? "#E5484D" : "#30B26F" }}
      >
        <Icon name="clock" size={20} />
        {state.ingeklokt ? t("clock.out") : t("clock.in")}
      </button>

      {fout && (
        <p className="text-center text-[13px]" style={{ color: "#E5484D" }}>{fout}</p>
      )}

      {/* Historie */}
      {state.historie.length > 0 && (
        <div className="card">
          <p className="eyebrow mb-2">{t("clock.recent")}</p>
          <div className="space-y-1.5">
            {state.historie.slice(0, 10).map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between text-[13px] py-1"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: e.type === "in" ? "#30B26F" : "var(--muted)" }}
                  />
                  <span style={{ color: "var(--text)" }}>
                    {e.type === "in" ? t("clock.in_status") : t("clock.out_past")}
                  </span>
                  {e.handmatig && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--hairline)", color: "var(--muted)" }}>
                      {t("clock.manual")}
                    </span>
                  )}
                </span>
                <span className="tabular-nums" style={{ color: "var(--muted)" }}>
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
