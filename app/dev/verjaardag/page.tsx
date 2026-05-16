"use client";

/**
 * Dev-preview voor de verjaardags-viering. Stel een naam in, klik "speel af"
 * en zie/hoor exact wat een medewerker ziet op zijn echte verjaardag.
 *
 * Triggert het component met geboortedatum = vandaag, en wist de
 * localStorage-flag zodat je 't meerdere keren kan testen.
 */
import { useState } from "react";
import VerjaardagsViering from "@/components/medewerker/VerjaardagsViering";

function vandaagISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

export default function VerjaardagPreview() {
  const [voornaam, setVoornaam] = useState("Sara");
  const [run, setRun] = useState(0);

  function speelAf() {
    // Wis de "al gezien" vlag van vandaag zodat de animatie opnieuw triggert
    const sleutel = `sg_verjaardag_gezien_${vandaagISO()}`;
    localStorage.removeItem(sleutel);
    setRun((n) => n + 1);
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-[24px] font-semibold mb-2" style={{ color: "var(--text)" }}>
        Verjaardag preview
      </h1>
      <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
        Voor handmatige test van de speelse verjaardags-intro met Happy Birthday + confetti + vuurwerk.
        Werkt alleen na een gebruikers-interactie (browsers blokkeren audio anders).
      </p>

      <label className="text-[11px] block mb-1" style={{ color: "var(--muted)" }}>Voornaam</label>
      <input
        value={voornaam}
        onChange={(e) => setVoornaam(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl text-[15px] mb-4"
        style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
      />

      <button
        onClick={speelAf}
        className="w-full py-3 rounded-xl text-[15px] font-semibold text-white"
        style={{ background: "#30B26F" }}
      >
        🎂 Speel verjaardag af
      </button>

      <p className="text-[11px] mt-6" style={{ color: "var(--muted)" }}>
        Het component checkt of vandaag's MM-DD overeenkomt met de geboortedatum.
        We sturen hier vandaag mee als geboortedatum, zodat de viering altijd triggert.
      </p>

      {run > 0 && (
        <VerjaardagsViering
          key={run}
          voornaam={voornaam}
          geboortedatum={vandaagISO()}
          vandaag={vandaagISO()}
        />
      )}
    </main>
  );
}
