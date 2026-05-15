"use client";

/**
 * Welkomstscherm na voltooide onboarding — medewerker wacht op
 * goedkeuring door owner/manager voordat 'ie het rooster kan zien.
 *
 * Geen bottom-nav (zie MedewerkerNav: verbergt zich op /m/wachten).
 * Wel uitlog-knop zodat 'ie kan switchen naar ander account.
 */

interface Props { voornaam: string }

async function uitloggen() {
  await fetch("/api/medewerker/uitloggen", { method: "POST" }).catch(() => null);
  window.location.href = "/m/login";
}

export default function MedewerkerWachten({ voornaam }: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6"
        style={{
          background: "linear-gradient(135deg, #30B26F 0%, #1F7A4E 100%)",
          color: "#fff",
          boxShadow: "0 0 30px -8px rgba(48,178,111,0.6)",
        }}
      >
        🎉
      </div>

      <h1
        className="text-[26px] font-semibold tracking-tight mb-2"
        style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
      >
        Welkom bij het team, {voornaam}!
      </h1>

      <p className="text-[15px] max-w-sm mb-1" style={{ color: "var(--text-2)" }}>
        Je gegevens zijn ontvangen.
      </p>
      <p className="text-[14px] max-w-sm mb-8" style={{ color: "var(--muted)" }}>
        Een manager keurt je aanmelding binnen 24 uur goed. Zodra dat
        gebeurd is kun je inloggen en de app gebruiken — je krijgt dan
        je rooster, kan je beschikbaarheid doorgeven en je uren bekijken.
      </p>

      <div
        className="w-full max-w-sm rounded-2xl p-4 mb-6"
        style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--hairline)",
        }}
      >
        <p className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
          Wat we hebben ontvangen
        </p>
        <ul className="text-[13px] text-left space-y-1.5" style={{ color: "var(--text-2)" }}>
          <li>✓ Persoonsgegevens (NAW + geboortedatum)</li>
          <li>✓ IBAN voor loonbetaling</li>
          <li>✓ BSN (versleuteld opgeslagen)</li>
          <li>✓ Foto ID / paspoort + bankpas</li>
        </ul>
      </div>

      <button
        onClick={uitloggen}
        className="text-[13px] underline"
        style={{ color: "var(--muted)" }}
      >
        Uitloggen
      </button>
    </main>
  );
}
