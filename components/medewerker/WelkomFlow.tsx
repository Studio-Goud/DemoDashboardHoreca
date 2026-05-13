"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props { token: string }

type Fase = "valideren" | "code-invoeren" | "pin-kiezen" | "pin-bevestigen" | "klaar" | "ongeldig";

export default function WelkomFlow({ token }: Props) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>(token ? "valideren" : "code-invoeren");

  // Voor token-flow (email-link)
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");

  // Voor code-flow (handmatige invoer)
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // URL-token validatie bij mount (email-flow)
  useEffect(() => {
    if (!token) return;
    fetch(`/api/medewerker/registreren?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, data: j })))
      .then(({ ok, data }) => {
        if (!ok) {
          setFase("ongeldig");
          setFout(data.error || "Token ongeldig");
        } else {
          setNaam(data.voornaam);
          setEmail(data.email);
          setFase("pin-kiezen");
        }
      })
      .catch(() => {
        setFase("ongeldig");
        setFout("Kon verbinding niet maken");
      });
  }, [token]);

  async function codeValideren() {
    setFout(null);
    if (!/^\S+@\S+\.\S+$/.test(emailInput)) {
      setFout("Vul een geldig e-mailadres in");
      return;
    }
    if (!/^\d{6}$/.test(codeInput)) {
      setFout("De code is 6 cijfers");
      return;
    }
    setBusy(true);
    try {
      // We valideren impliciet door registratie te proberen — maar we hebben
      // eerst de PIN nodig. Dus we tonen de PIN-keuze en valideren bij submit.
      setEmail(emailInput);
      setFase("pin-kiezen");
    } finally {
      setBusy(false);
    }
  }

  function drukPin(c: string, naar: "pin" | "pin2") {
    setFout(null);
    if (naar === "pin") {
      if (pin.length >= 4) return;
      const nieuw = pin + c;
      setPin(nieuw);
      if (nieuw.length === 4) setTimeout(() => setFase("pin-bevestigen"), 200);
    } else {
      if (pin2.length >= 4) return;
      const nieuw = pin2 + c;
      setPin2(nieuw);
      if (nieuw.length === 4) {
        if (nieuw === pin) submitPin(pin);
        else {
          setFout("PINs komen niet overeen");
          setTimeout(() => { setPin2(""); setFase("pin-kiezen"); setPin(""); }, 1200);
        }
      }
    }
  }

  function wis(naar: "pin" | "pin2") {
    setFout(null);
    if (naar === "pin") setPin((v) => v.slice(0, -1));
    else setPin2((v) => v.slice(0, -1));
  }

  async function submitPin(p: string) {
    setBusy(true);
    setFout(null);
    try {
      const body = token
        ? { token, pin: p }
        : { email: emailInput, code: codeInput, pin: p };
      const res = await fetch("/api/medewerker/registreren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "kon niet opslaan");
      }
      setFase("klaar");
      setTimeout(() => router.replace("/m/login?email=" + encodeURIComponent(email)), 1500);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
      setFase(token ? "pin-kiezen" : "code-invoeren");
      setPin("");
      setPin2("");
    } finally {
      setBusy(false);
    }
  }

  if (fase === "valideren") {
    return (
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{ border: "2px solid var(--hairline)", borderTopColor: "var(--text-2)" }}
      />
    );
  }

  if (fase === "ongeldig") {
    return (
      <div className="max-w-sm text-center">
        <p className="eyebrow mb-2">Welkom-link</p>
        <h1 className="text-[22px] font-semibold mb-2" style={{ color: "var(--text)" }}>
          Deze link werkt niet meer
        </h1>
        <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>
          {fout || "De link is ongeldig of verlopen. Vraag je manager om een nieuwe code."}
        </p>
        <button
          onClick={() => { setFase("code-invoeren"); setFout(null); }}
          className="text-[13px] underline"
          style={{ color: "#0A84FF" }}
        >
          Ik heb een 6-cijferige code →
        </button>
      </div>
    );
  }

  if (fase === "klaar") {
    return (
      <div className="max-w-sm text-center fade-up">
        <p className="eyebrow mb-2">Klaar</p>
        <h1 className="text-[24px] font-semibold mb-1" style={{ color: "var(--text)" }}>
          PIN ingesteld ✓
        </h1>
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          We sturen je nu door naar het inlogscherm…
        </p>
      </div>
    );
  }

  if (fase === "code-invoeren") {
    return (
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">Markthal HQ</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            Welkom bij het team
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            Vul je e-mailadres en de 6-cijferige code in die je manager je heeft gegeven.
          </p>
        </div>

        <label className="eyebrow block mb-1.5">E-mailadres</label>
        <input
          type="email"
          value={emailInput}
          autoFocus
          onChange={(e) => setEmailInput(e.target.value)}
          className="w-full px-3 py-3 rounded-[10px] text-[15px] mb-3"
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline)",
            color: "var(--text)",
          }}
          placeholder="jouw@email.nl"
        />

        <label className="eyebrow block mb-1.5">Registratiecode (6 cijfers)</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && codeValideren()}
          className="w-full px-3 py-3 rounded-[10px] text-[24px] font-semibold tabular-nums tracking-widest text-center"
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline)",
            color: "var(--text)",
            letterSpacing: "0.2em",
          }}
          placeholder="000000"
        />

        {fout && (
          <p className="mt-3 text-[13px]" style={{ color: "#E5484D" }}>{fout}</p>
        )}

        <button
          onClick={codeValideren}
          disabled={busy || !emailInput || codeInput.length !== 6}
          className="w-full mt-4 py-3 rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-50"
          style={{ background: "#0A84FF" }}
        >
          {busy ? "Bezig…" : "Volgende"}
        </button>
      </div>
    );
  }

  const huidigeWaarde = fase === "pin-kiezen" ? pin : pin2;
  const huidigeNaar: "pin" | "pin2" = fase === "pin-kiezen" ? "pin" : "pin2";

  return (
    <div className="max-w-sm w-full">
      <div className="text-center mb-8">
        <p className="eyebrow mb-2">{token ? `Welkom ${naam}` : `Welkom`}</p>
        <h1
          className="text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
        >
          {fase === "pin-kiezen" ? "Kies een 4-cijferige PIN" : "Bevestig je PIN"}
        </h1>
        <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
          {fase === "pin-kiezen"
            ? "Onthoud 'm goed — hiermee log je voortaan in."
            : "Voer 'm nog één keer in om te bevestigen."}
        </p>
      </div>

      <div className="flex justify-center gap-3.5 mb-10">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < huidigeWaarde.length;
          return (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-150"
              style={{
                background: fout ? "#E5484D" : filled ? "var(--text)" : "transparent",
                border: `1.5px solid ${fout ? "#E5484D" : filled ? "var(--text)" : "var(--hairline)"}`,
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 w-64 mx-auto">
        {["1","2","3","4","5","6","7","8","9"].map((c) => (
          <button
            key={c}
            disabled={busy}
            onClick={() => drukPin(c, huidigeNaar)}
            className="h-16 rounded-full text-[22px] font-light transition-colors disabled:opacity-40"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
          >
            {c}
          </button>
        ))}
        <div />
        <button
          disabled={busy}
          onClick={() => drukPin("0", huidigeNaar)}
          className="h-16 rounded-full text-[22px] font-light transition-colors disabled:opacity-40"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
        >
          0
        </button>
        <button
          disabled={busy}
          onClick={() => wis(huidigeNaar)}
          className="h-16 rounded-full text-[14px] disabled:opacity-40"
          style={{ color: "var(--muted)" }}
        >
          ⌫
        </button>
      </div>

      {fout && (
        <p className="mt-6 text-center text-[13px]" style={{ color: "#E5484D" }}>
          {fout}
        </p>
      )}
    </div>
  );
}
