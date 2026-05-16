"use client";

/**
 * Modal die na een PIN-login op /m verschijnt en de medewerker vraagt om
 * Face ID / Touch ID op dit apparaat in te stellen. Analoog aan
 * components/FaceIDPromptModal.tsx (admin-versie), maar gescopt op
 * /api/medewerker/webauthn/* zodat credentials in de DB-tabel
 * `medewerker_passkeys` landen, niet in Vercel KV onder een admin-PIN.
 *
 * Triggert alleen als:
 *   - browser ondersteunt WebAuthn
 *   - sessionStorage `sg_mw_via_pin` === "1" (gezet door PIN-reset of login flow)
 *   - gebruiker heeft `sg_faceid_mw_geweigerd` niet op "1" gezet
 *   - server bevestigt: nog géén passkey op dit account
 */
import { useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

const DISMISS_KEY = "sg_faceid_mw_geweigerd";
const VIA_PIN_KEY = "sg_mw_via_pin";

export default function MedewerkerFaceIDPrompt() {
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState(false);

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined") return;
      if (!browserSupportsWebAuthn()) return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (sessionStorage.getItem(VIA_PIN_KEY) !== "1") return;
      try {
        const res = await fetch("/api/medewerker/webauthn/has-mine", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { aantal: number };
        if (data.aantal > 0) {
          // Heeft al een passkey — flag wissen zodat de modal niet meer triggert.
          sessionStorage.removeItem(VIA_PIN_KEY);
          return;
        }
        setZichtbaar(true);
      } catch {
        /* netwerk fout → skip */
      }
    }
    check();
  }, []);

  async function stelIn() {
    setBezig(true);
    setFout(null);
    try {
      const beginRes = await fetch("/api/medewerker/webauthn/register/begin", { method: "POST" });
      if (!beginRes.ok) {
        const j = await beginRes.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "kan niet starten");
      }
      const { options, sessionId } = await beginRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const deviceLabel = navigator.userAgent.includes("iPhone")
        ? "iPhone"
        : navigator.userAgent.includes("iPad")
        ? "iPad"
        : navigator.userAgent.includes("Mac")
        ? "Mac"
        : "Apparaat";
      const completeRes = await fetch("/api/medewerker/webauthn/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attestation, deviceLabel }),
      });
      if (!completeRes.ok) {
        const j = await completeRes.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "instellen mislukt");
      }
      sessionStorage.removeItem(VIA_PIN_KEY);
      setKlaar(true);
      setTimeout(() => setZichtbaar(false), 1200);
    } catch (e) {
      const bericht = e instanceof Error ? e.message : "onbekend";
      const cancel = bericht.includes("NotAllowedError") || bericht.includes("aborted");
      setFout(cancel ? "Afgebroken — je kan het later via je profiel proberen" : bericht);
    } finally {
      setBezig(false);
    }
  }

  function nietNu() {
    localStorage.setItem(DISMISS_KEY, "1");
    sessionStorage.removeItem(VIA_PIN_KEY);
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
            style={{ background: "#30B26F", color: "#fff" }}
          >
            {klaar ? "✓" : "🔐"}
          </div>
        </div>
        <h2 className="text-center text-[18px] font-semibold mb-2" style={{ color: "var(--text)" }}>
          {klaar ? "Klaar!" : "Sneller inloggen met Face ID?"}
        </h2>
        <p className="text-center text-[13px] mb-5" style={{ color: "var(--muted)" }}>
          {klaar
            ? "Volgende keer log je in met je gezicht of vingerafdruk."
            : "Stel Face ID of Touch ID in op dit apparaat. Volgende keer log je in zonder PIN te tikken — je PIN blijft als backup."}
        </p>
        {fout && (
          <p className="text-[12px] text-center mb-3" style={{ color: "#E5484D" }}>
            {fout}
          </p>
        )}
        {!klaar && (
          <>
            <button
              onClick={stelIn}
              disabled={bezig}
              className="w-full py-3 rounded-xl text-[15px] font-semibold text-white disabled:opacity-60 mb-2"
              style={{ background: "#30B26F" }}
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
          </>
        )}
      </div>
    </div>
  );
}
