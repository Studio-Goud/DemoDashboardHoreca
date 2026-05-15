"use client";

import { useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

interface Props {
  hex: string;
}

export default function FaceIDOpzetten({ hex }: Props) {
  const [ondersteund, setOndersteund] = useState<boolean | null>(null);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    setOndersteund(browserSupportsWebAuthn());
  }, []);

  async function stelIn() {
    setBezig(true);
    setResultaat(null);
    setFout(null);
    try {
      const beginRes = await fetch("/api/auth/webauthn/register/begin", { method: "POST" });
      if (!beginRes.ok) {
        const j = await beginRes.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "register/begin mislukt");
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

      const completeRes = await fetch("/api/auth/webauthn/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attestation, deviceLabel }),
      });
      if (!completeRes.ok) {
        const j = await completeRes.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "register/complete mislukt");
      }
      setResultaat("✓ Face ID / Touch ID is ingesteld. Volgende keer kun je inloggen zonder PIN.");
    } catch (e) {
      const bericht = e instanceof Error ? e.message : "onbekend";
      const isCancel = bericht.includes("NotAllowedError") || bericht.includes("aborted");
      setFout(isCancel ? "Afgebroken — probeer opnieuw" : bericht);
    } finally {
      setBezig(false);
    }
  }

  if (ondersteund === false) {
    return (
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Deze browser ondersteunt geen passkeys. Gebruik Safari op iOS 16+ of een recente versie van Chrome/Edge.
      </p>
    );
  }
  if (ondersteund === null) return null;

  return (
    <div>
      <button
        onClick={stelIn}
        disabled={bezig}
        className="text-[13px] font-medium px-4 py-2 rounded-md text-white disabled:opacity-60"
        style={{ background: hex }}
      >
        {bezig ? "Bezig…" : "🔐 Face ID / Touch ID instellen"}
      </button>
      <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
        Eenmalig instellen op dit apparaat. Volgende keer log je in zonder PIN — je PIN blijft als backup beschikbaar.
      </p>
      {resultaat && (
        <p className="text-[12px] mt-2" style={{ color: "#30B26F" }}>
          {resultaat}
        </p>
      )}
      {fout && (
        <p className="text-[12px] mt-2" style={{ color: "#E5484D" }}>
          ✗ {fout}
        </p>
      )}
    </div>
  );
}
