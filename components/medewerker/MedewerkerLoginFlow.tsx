"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props { ingevuldEmail: string }

export default function MedewerkerLoginFlow({ ingevuldEmail }: Props) {
  const router = useRouter();
  const [fase, setFase] = useState<"email" | "pin">(ingevuldEmail ? "pin" : "email");
  const [email, setEmail] = useState(ingevuldEmail);
  const [pin, setPin] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function emailDoor() {
    setFout(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFout("Vul een geldig e-mailadres in");
      return;
    }
    setFase("pin");
  }

  function drukPin(c: string) {
    setFout(null);
    if (pin.length >= 4 || busy) return;
    const nieuw = pin + c;
    setPin(nieuw);
    if (nieuw.length === 4) submit(nieuw);
  }

  function wis() {
    setFout(null);
    setPin((v) => v.slice(0, -1));
  }

  async function submit(p: string) {
    setBusy(true);
    setFout(null);
    try {
      const res = await fetch("/api/medewerker/inloggen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin: p }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "Inloggen mislukt");
      }
      router.replace("/m");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  if (fase === "email") {
    return (
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">Studio Goud</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            Inloggen medewerker
          </h1>
        </div>
        <label className="eyebrow block mb-1.5">E-mailadres</label>
        <input
          type="email"
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && emailDoor()}
          className="w-full px-3 py-3 rounded-[10px] text-[15px]"
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline)",
            color: "var(--text)",
          }}
          placeholder="jouw@email.nl"
        />
        {fout && (
          <p className="mt-3 text-[13px]" style={{ color: "#E5484D" }}>{fout}</p>
        )}
        <button
          onClick={emailDoor}
          className="w-full mt-4 py-3 rounded-[10px] text-[15px] font-semibold text-white"
          style={{ background: "#0A84FF" }}
        >
          Volgende
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm w-full">
      <div className="text-center mb-8">
        <p className="eyebrow mb-2">{email}</p>
        <h1
          className="text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
        >
          Voer je PIN in
        </h1>
        <button
          onClick={() => { setFase("email"); setPin(""); setFout(null); }}
          className="mt-3 text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          ← ander e-mailadres
        </button>
      </div>

      <div className="flex justify-center gap-3.5 mb-10">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < pin.length;
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
            onClick={() => drukPin(c)}
            className="h-16 rounded-full text-[22px] font-light transition-colors disabled:opacity-40"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
          >
            {c}
          </button>
        ))}
        <div />
        <button
          disabled={busy}
          onClick={() => drukPin("0")}
          className="h-16 rounded-full text-[22px] font-light transition-colors disabled:opacity-40"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
        >
          0
        </button>
        <button
          disabled={busy}
          onClick={wis}
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
