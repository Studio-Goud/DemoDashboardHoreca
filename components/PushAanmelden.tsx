"use client";

import { useEffect, useState } from "react";

interface Props {
  hex: string;
  naam?: string;          // wie de eigenaar van deze telefoon is
}

type Status =
  | "checking"
  | "niet-ondersteund"
  | "pwa-vereist"
  | "permission-denied"
  | "inactief"
  | "bezig"
  | "actief"
  | "fout";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export default function PushAanmelden({ hex, naam }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [foutTekst, setFoutTekst] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("niet-ondersteund");
        return;
      }
      // Op iOS werkt Web Push alleen als de PWA op het homescreen staat
      if (isIos() && !isPwaInstalled()) {
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
        setFoutTekst(e instanceof Error ? e.message : "onbekend");
        setStatus("fout");
      }
    }
    check();
  }, []);

  async function aanmelden() {
    if (!PUBLIC_KEY) {
      setFoutTekst("VAPID public key niet in build — redeploy vereist.");
      setStatus("fout");
      return;
    }
    setStatus("bezig");
    setFoutTekst(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("permission-denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const appServerKey = urlBase64ToUint8Array(PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast voor TS: browsers accepteren Uint8Array, maar de type-
        // defs verwachten strikt BufferSource<ArrayBuffer>.
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          naam: naam ?? sessionStorage.getItem("sg_user") ?? undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setStatus("actief");
    } catch (e) {
      setFoutTekst(e instanceof Error ? e.message : "onbekend");
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
          `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: "DELETE" }
        );
        await sub.unsubscribe();
      }
      setStatus("inactief");
    } catch (e) {
      setFoutTekst(e instanceof Error ? e.message : "onbekend");
      setStatus("fout");
    }
  }

  async function testen() {
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFoutTekst(j.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setFoutTekst(e instanceof Error ? e.message : "onbekend");
    }
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-700 mb-1">Dagelijkse notificaties</h3>
      <p className="text-[11px] text-slate-400 mb-3">
        Elke ochtend om 09:00 een overzicht op je telefoon. Tijdens openingsuren
        ook een melding als je &lt; 70% van de dag-verwachting haalt.
      </p>

      {status === "checking" && (
        <p className="text-sm text-slate-500">Controleren…</p>
      )}

      {status === "niet-ondersteund" && (
        <p className="text-sm text-slate-600">
          Deze browser ondersteunt geen push-notificaties.
        </p>
      )}

      {status === "pwa-vereist" && (
        <div className="text-sm text-slate-700 space-y-2">
          <p>
            Op iPhone werken notificaties alleen als je deze app eerst op je
            beginscherm zet:
          </p>
          <ol className="list-decimal pl-5 text-[13px] text-slate-600 space-y-1">
            <li>Tik op de <strong>deel-knop</strong> (vierkant met pijltje omhoog)</li>
            <li>Scroll → <strong>Zet op beginscherm</strong></li>
            <li>Open dan deze app vanaf het icoon op je beginscherm</li>
          </ol>
        </div>
      )}

      {status === "permission-denied" && (
        <p className="text-sm text-slate-600">
          Notificaties zijn geblokkeerd. Zet ze aan in de instellingen van je
          telefoon voor deze app.
        </p>
      )}

      {(status === "inactief" || status === "bezig") && (
        <button
          onClick={aanmelden}
          disabled={status === "bezig"}
          className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: hex }}
        >
          {status === "bezig" ? "Bezig…" : "Notificaties aanzetten"}
        </button>
      )}

      {status === "actief" && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-emerald-700 font-medium">
            ✓ Notificaties staan aan op deze telefoon
          </span>
          <button
            onClick={testen}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Testen
          </button>
          <button
            onClick={afmelden}
            className="px-3 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-700"
          >
            Uitzetten
          </button>
        </div>
      )}

      {status === "fout" && (
        <div className="text-sm text-red-600">
          Iets ging mis: {foutTekst}
        </div>
      )}
    </div>
  );
}
