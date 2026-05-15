"use client";

/**
 * Zelf-registratie voor medewerkers. 3 stappen:
 * 1. Account-info (voornaam, achternaam, email, wachtwoord)
 * 2. Kies een 4-cijferige PIN (voor snellere logins)
 * 3. Redirect naar /m/profiel voor NAW + IBAN + BSN
 *
 * Stap 2 is optioneel — gebruiker kan 'm overslaan en later instellen.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Fase = "account" | "pin" | "klaar";

export default function MedewerkerRegistratieFlow() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("account");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");

  const [pin, setPin] = useState("");

  async function accountAanmaken(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (wachtwoord.length < 8) {
      setFout("Wachtwoord moet minstens 8 tekens zijn");
      return;
    }
    setBezig(true);
    try {
      const res = await fetch("/api/medewerker/account-aanmaken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voornaam, achternaam, email, wachtwoord }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "registratie mislukt");
      }
      setFase("pin");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  function drukPin(c: string) {
    if (pin.length >= 4) return;
    setPin((p) => p + c);
    setFout(null);
  }

  function wisPin() {
    setPin((p) => p.slice(0, -1));
    setFout(null);
  }

  async function pinOpslaan() {
    if (pin.length !== 4) {
      setFout("PIN moet 4 cijfers zijn");
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/medewerker/pin-instellen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "PIN opslaan mislukt");
      }
      setFase("klaar");
      // Korte zichtbaarheid van succes-stap, dan door naar profiel-onboarding
      setTimeout(() => router.replace("/m/profiel?welkom=1"), 800);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  function slaPinOver() {
    router.replace("/m/profiel?welkom=1");
  }

  // ─── Stap 1: account-info ──────────────────────────────────────────────────
  if (fase === "account") {
    return (
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">Markthal HQ</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.019em" }}>
            Account aanmaken
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            Welkom bij Markthal HQ. Vul je gegevens in om te beginnen.
          </p>
        </div>

        <form onSubmit={accountAanmaken} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              autoComplete="given-name"
              placeholder="Voornaam"
              value={voornaam}
              onChange={(e) => setVoornaam(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            />
            <input
              type="text"
              required
              autoComplete="family-name"
              placeholder="Achternaam"
              value={achternaam}
              onChange={(e) => setAchternaam(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            />
          </div>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="E-mailadres"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[15px]"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Wachtwoord (min. 8 tekens)"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[15px]"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
          />
          {fout && (
            <p className="text-[12px]" style={{ color: "#E5484D" }}>{fout}</p>
          )}
          <button
            type="submit"
            disabled={bezig}
            className="w-full py-3 rounded-xl text-[15px] font-semibold text-white disabled:opacity-60"
            style={{ background: "#30B26F" }}
          >
            {bezig ? "Bezig…" : "Account aanmaken"}
          </button>
        </form>

        <p className="text-center text-[12px] mt-6" style={{ color: "var(--muted)" }}>
          Al een account?{" "}
          <Link href="/m/login" className="underline">Inloggen</Link>
        </p>
      </div>
    );
  }

  // ─── Stap 2: PIN kiezen ─────────────────────────────────────────────────────
  if (fase === "pin") {
    return (
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="eyebrow mb-2" style={{ color: "#30B26F" }}>Stap 2 van 3</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.019em" }}>
            Kies een PIN
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            4-cijferige PIN voor snel inloggen. Je wachtwoord blijft als backup.
          </p>
        </div>

        <div className="flex justify-center gap-3.5 mb-8">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            return (
              <div
                key={i}
                className="w-3 h-3 rounded-full transition-all duration-150"
                style={{
                  background: filled ? "var(--text)" : "transparent",
                  border: `1.5px solid ${filled ? "var(--text)" : "var(--hairline)"}`,
                }}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-3 w-64 mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
            <button
              key={c}
              onClick={() => drukPin(c)}
              className="h-16 rounded-full text-[22px] font-light transition-colors"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            >
              {c}
            </button>
          ))}
          <div />
          <button
            onClick={() => drukPin("0")}
            className="h-16 rounded-full text-[22px] font-light"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
          >
            0
          </button>
          <button
            onClick={wisPin}
            className="h-16 rounded-full text-[14px]"
            style={{ color: "var(--muted)" }}
            aria-label="Wissen"
          >
            ⌫
          </button>
        </div>

        {fout && (
          <p className="text-center text-[12px] mt-4" style={{ color: "#E5484D" }}>{fout}</p>
        )}

        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={pinOpslaan}
            disabled={bezig || pin.length !== 4}
            className="w-full py-3 rounded-xl text-[15px] font-semibold text-white disabled:opacity-60"
            style={{ background: "#30B26F" }}
          >
            {bezig ? "Bezig…" : "PIN opslaan"}
          </button>
          <button
            onClick={slaPinOver}
            disabled={bezig}
            className="w-full py-3 rounded-xl text-[14px]"
            style={{ color: "var(--muted)" }}
          >
            Overslaan voor nu
          </button>
        </div>
      </div>
    );
  }

  // ─── Stap 3: klaar ──────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4"
           style={{ background: "#30B26F", color: "#fff" }}>
        ✓
      </div>
      <h1 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text)" }}>
        Welkom!
      </h1>
      <p className="text-[13px]" style={{ color: "var(--muted)" }}>
        Even je gegevens compleet maken…
      </p>
    </div>
  );
}
