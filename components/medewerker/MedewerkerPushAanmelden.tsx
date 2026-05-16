"use client";

/**
 * Push-opt-in voor medewerkers. Vergelijkbaar met components/PushAanmelden.tsx
 * (admin-versie) maar gekoppeld aan de medewerker-sessie en met andere
 * tekstuele context (manager-mededelingen + ruilverzoeken).
 *
 * iOS-noot: WebPush werkt alleen als de PWA aan het beginscherm is toegevoegd.
 * Component detecteert dat en toont een setup-instructie ipv een knop.
 */
import { useEffect, useState } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Status =
  | "checking"
  | "niet-ondersteund"
  | "pwa-vereist"
  | "permission-denied"
  | "inactief"
  | "bezig"
  | "actief"
  | "fout";

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

function bedenkDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Windows")) return "Windows";
  return "Apparaat";
}

export default function MedewerkerPushAanmelden() {
  const [status, setStatus] = useState<Status>("checking");
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("niet-ondersteund");
        return;
      }
      if (isIos() && !isPwa()) {
        setStatus("pwa-vereist");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("permission-denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "actief" : "inactief");
      } catch (e) {
        setFout(e instanceof Error ? e.message : "onbekend");
        setStatus("fout");
      }
    }
    check();
  }, []);

  async function aanmelden() {
    if (!PUBLIC_KEY) {
      setFout("VAPID public key ontbreekt in build");
      setStatus("fout");
      return;
    }
    setStatus("bezig");
    setFout(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("permission-denied");
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
          deviceLabel: bedenkDeviceLabel(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setStatus("actief");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "onbekend");
      setStatus("fout");
    }
  }

  async function afmelden() {
    setStatus("bezig");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(
          `/api/medewerker/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: "DELETE" },
        );
        await sub.unsubscribe();
      }
      setStatus("inactief");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "onbekend");
      setStatus("fout");
    }
  }

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
    >
      <h3 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text)" }}>
        Notificaties
      </h3>
      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Krijg een bericht als het rooster gepubliceerd wordt, of als een collega
        zoekt naar een ruilpartner voor zijn dienst.
      </p>

      {status === "checking" && (
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>Controleren…</p>
      )}

      {status === "niet-ondersteund" && (
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Deze browser ondersteunt geen push-notificaties.
        </p>
      )}

      {status === "pwa-vereist" && (
        <div className="text-[12px]" style={{ color: "var(--text-2)" }}>
          <p className="mb-1.5">Op iPhone werken notificaties alleen vanuit de app op je beginscherm:</p>
          <ol className="list-decimal pl-5 space-y-0.5" style={{ color: "var(--muted)" }}>
            <li>Tik op deel-knop (vierkant met pijltje)</li>
            <li>Scroll → "Zet op beginscherm"</li>
            <li>Open de app vanaf het icoon</li>
          </ol>
        </div>
      )}

      {status === "permission-denied" && (
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Notificaties staan geblokkeerd. Zet ze aan in de telefoon-instellingen voor deze app.
        </p>
      )}

      {(status === "inactief" || status === "bezig") && (
        <button
          onClick={aanmelden}
          disabled={status === "bezig"}
          className="px-4 py-2 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50"
          style={{ background: "#0A84FF" }}
        >
          {status === "bezig" ? "Bezig…" : "🔔 Notificaties aanzetten"}
        </button>
      )}

      {status === "actief" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px]" style={{ color: "#30B26F" }}>
            ✓ Notificaties staan aan
          </span>
          <button
            onClick={afmelden}
            className="text-[11px] underline"
            style={{ color: "var(--muted)" }}
          >
            Uitzetten
          </button>
        </div>
      )}

      {status === "fout" && (
        <p className="text-[12px]" style={{ color: "#E5484D" }}>
          Iets ging mis: {fout}
        </p>
      )}
    </section>
  );
}
