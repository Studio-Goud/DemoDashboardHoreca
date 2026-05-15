"use client";

/**
 * Modal die direct na een eerste PIN-login verschijnt en vraagt om Face ID
 * in te stellen. Toont zich alleen als de gebruiker nog géén passkey heeft
 * voor zijn/haar rol, en niet eerder op "Niet nu" heeft geklikt.
 *
 * Geen aparte navigatie nodig — eenmalig instellen direct na inloggen, of
 * weigeren en doorgaan. Bij weigeren wordt een dismiss-flag in localStorage
 * gezet zodat 'ie niet bij elke login terugkomt; via Setup-tab kan de owner
 * 'm alsnog handmatig opzetten.
 */
import { useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

const DISMISS_KEY = "sg_faceid_geweigerd";

interface Props {
  hex: string;
}

export default function FaceIDPromptModal({ hex }: Props) {
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      // 1. Browser ondersteunt geen WebAuthn? skip.
      if (typeof window === "undefined") return;
      if (!browserSupportsWebAuthn()) return;
      // 2. Eerder geweigerd? skip.
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      // 3. Niet via PIN ingelogd in deze sessie (bv. Face ID-flow)? skip.
      if (sessionStorage.getItem("sg_via_pin") !== "1") return;
      // 4. Heeft DEZE specifieke gebruiker al een passkey? Per-user check
      // via /has-mine (kijkt op basis van admin-cookie, niet op rol-totaal).
      // Zo komt de modal NIET terug nadat 'ie 'm al heeft ingesteld.
      try {
        const res = await fetch("/api/auth/webauthn/has-mine", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { aantal: number };
        if (data.aantal > 0) return; // gebruiker heeft al een passkey
        setZichtbaar(true);
      } catch { /* netwerk error → skip */ }
    }
    check();
  }, []);

  async function stelIn() {
    setBezig(true);
    setFout(null);
    try {
      const beginRes = await fetch("/api/auth/webauthn/register/begin", { method: "POST" });
      if (!beginRes.ok) throw new Error("kan niet starten");
      const { options, sessionId } = await beginRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const deviceLabel = navigator.userAgent.includes("iPhone") ? "iPhone"
        : navigator.userAgent.includes("iPad") ? "iPad"
        : navigator.userAgent.includes("Mac") ? "Mac"
        : "Apparaat";
      const completeRes = await fetch("/api/auth/webauthn/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attestation, deviceLabel }),
      });
      if (!completeRes.ok) {
        const j = await completeRes.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "instellen mislukt");
      }
      // Klaar — sluit modal, geen dismiss-flag (volgende login werkt direct
      // met Face ID, modal komt vanzelf niet meer omdat aantal ≥ 1).
      setZichtbaar(false);
    } catch (e) {
      const bericht = e instanceof Error ? e.message : "onbekend";
      const cancel = bericht.includes("NotAllowedError") || bericht.includes("aborted");
      setFout(cancel ? "Afgebroken — je kan het later via Setup proberen" : bericht);
    } finally {
      setBezig(false);
    }
  }

  function nietNu() {
    localStorage.setItem(DISMISS_KEY, "1");
    setZichtbaar(false);
  }

  if (!zichtbaar) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-[20px] p-6 shadow-2xl"
        style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: hex, color: "#fff" }}
          >
            🔐
          </div>
        </div>
        <h2 className="text-center text-[18px] font-semibold mb-2" style={{ color: "var(--text)" }}>
          Sneller inloggen?
        </h2>
        <p className="text-center text-[13px] mb-5" style={{ color: "var(--muted)" }}>
          Stel Face ID of Touch ID in op dit apparaat. Volgende keer hoef je geen PIN te
          tikken — je gezicht of vingerafdruk is genoeg. Je PIN blijft als backup.
        </p>
        {fout && (
          <p className="text-[12px] text-center mb-3" style={{ color: "#E5484D" }}>
            {fout}
          </p>
        )}
        <button
          onClick={stelIn}
          disabled={bezig}
          className="w-full py-3 rounded-xl text-[15px] font-semibold text-white disabled:opacity-60 mb-2"
          style={{ background: hex }}
        >
          {bezig ? "Bezig…" : "✓ Instellen"}
        </button>
        <button
          onClick={nietNu}
          className="w-full py-3 rounded-xl text-[14px]"
          style={{ color: "var(--muted)" }}
        >
          Niet nu
        </button>
        <p className="text-[10px] text-center mt-3" style={{ color: "var(--muted)" }}>
          Je kunt het later instellen via Administratie → Setup
        </p>
      </div>
    </div>
  );
}
