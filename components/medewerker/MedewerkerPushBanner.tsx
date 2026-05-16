"use client";

/**
 * Sticky banner bovenaan /m die de medewerker pushed om notificaties aan te
 * zetten — zonder push krijgen ze geen ruil-verzoeken of manager-mededelingen
 * door. Verdwijnt zodra een subscription actief is. Dismissable voor 7 dagen.
 *
 * Drie staten:
 *   - "Setup PWA nodig" (iOS in Safari, niet aan homescreen) → uitleg-stappen
 *   - "Klaar voor permission" (PWA / Android / desktop) → 1-tap-knop
 *   - Verborgen (al geabonneerd, of geweigerd door OS, of binnen 7d gedismissed)
 *
 * State wordt server-side gecontroleerd via /api/medewerker/push/subscribe
 * (GET) — zo onthoudt 'ie ook na switch naar nieuw apparaat dat 'ie al een
 * sub heeft (en kan UI op dat apparaat een nieuwe sub vragen zonder dubbel-
 * te-melden).
 */
import { useEffect, useState } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS_KEY = "sg_mw_push_dismissed_tot";

type Mode = "verborgen" | "pwa-vereist" | "aanzetten" | "uitleg" | "bezig";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac")) return "Mac";
  return "Apparaat";
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const tot = localStorage.getItem(DISMISS_KEY);
  if (!tot) return false;
  return Date.now() < Number(tot);
}

export default function MedewerkerPushBanner() {
  const [mode, setMode] = useState<Mode>("verborgen");
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission === "denied") return;
      if (isDismissed()) return;

      // iOS in Safari zonder PWA → toon setup-stappen
      if (isIos() && !isPwa()) {
        setMode("pwa-vereist");
        return;
      }

      // Heb ik op DIT device al een sub? (browser-state)
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) return; // al actief
      } catch {
        /* val door — toon aanzetten-knop */
      }

      setMode("aanzetten");
    }
    check();
  }, []);

  async function aanzetten() {
    if (!PUBLIC_KEY) {
      setFout("VAPID public key ontbreekt op de server");
      return;
    }
    setMode("bezig");
    setFout(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        // OS-vraag afgewezen → niet meer aandringen, browser onthoudt het toch
        setMode("verborgen");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = urlBase64ToUint8Array(PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer as ArrayBuffer,
      });
      const res = await fetch("/api/medewerker/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          deviceLabel: deviceLabel(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setMode("verborgen");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
      setMode("aanzetten");
    }
  }

  function laterVragen() {
    const overZevenDagen = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(overZevenDagen));
    setMode("verborgen");
  }

  if (mode === "verborgen") return null;

  // ─── iOS Safari (zonder PWA) ─────────────────────────────────────────────
  if (mode === "pwa-vereist" || mode === "uitleg") {
    return (
      <div
        className="rounded-2xl p-4 mb-4"
        style={{
          background: "linear-gradient(135deg, #0A84FF15 0%, #30B26F15 100%)",
          border: "1px solid #0A84FF55",
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="text-[24px]">🔔</span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              Zet notificaties aan
            </p>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Krijg een bericht zodra je rooster klaarstaat of een collega een ruil zoekt.
            </p>
          </div>
        </div>

        {mode === "pwa-vereist" && (
          <>
            <p className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>
              <strong>iPhone:</strong> notificaties werken alleen vanuit de app op je beginscherm.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-[12px] mb-3" style={{ color: "var(--text-2)" }}>
              <li>Tik onderaan op de <strong>delen-knop</strong> (vierkant met pijltje omhoog)</li>
              <li>Scroll naar beneden → <strong>"Zet op beginscherm"</strong></li>
              <li>Open de app vanaf het icoon op je beginscherm</li>
              <li>Tik daar nogmaals op "Notificaties aanzetten"</li>
            </ol>
            <button
              onClick={laterVragen}
              className="text-[11px] underline"
              style={{ color: "var(--muted)" }}
            >
              Later vragen
            </button>
          </>
        )}
      </div>
    );
  }

  // ─── PWA / Android / desktop — knop ──────────────────────────────────────
  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{
        background: "linear-gradient(135deg, #0A84FF15 0%, #30B26F15 100%)",
        border: "1px solid #0A84FF55",
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[24px]">🔔</span>
        <div className="flex-1">
          <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            Zet notificaties aan
          </p>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            Krijg een bericht zodra je rooster klaarstaat, of als een collega een ruilpartner zoekt voor zijn dienst.
          </p>
        </div>
      </div>

      {fout && (
        <p className="text-[12px] mb-2" style={{ color: "#E5484D" }}>{fout}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={aanzetten}
          disabled={mode === "bezig"}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60"
          style={{ background: "#0A84FF" }}
        >
          {mode === "bezig" ? "Bezig…" : "✓ Aanzetten"}
        </button>
        <button
          onClick={laterVragen}
          disabled={mode === "bezig"}
          className="px-3 py-2.5 rounded-xl text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
