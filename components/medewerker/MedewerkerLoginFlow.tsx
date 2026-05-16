"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTaal } from "@/lib/i18n/TaalProvider";

interface Props { ingevuldEmail: string }

export default function MedewerkerLoginFlow({ ingevuldEmail }: Props) {
  const router = useRouter();
  const { t } = useTaal();
  const [fase, setFase] = useState<"welkom" | "email" | "pin">(ingevuldEmail ? "pin" : "welkom");
  const [email, setEmail] = useState(ingevuldEmail);
  const [pin, setPin] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function emailDoor() {
    setFout(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFout(t("login.email_invalid"));
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
        throw new Error(j.error || t("login.failed"));
      }
      const data = (await res.json().catch(() => ({}))) as { moetPinResetten?: boolean };
      // Flag voor MedewerkerFaceIDPrompt — pas tonen ná PIN-flow.
      sessionStorage.setItem("sg_mw_via_pin", "1");
      if (data.moetPinResetten) {
        router.replace("/m/pin-resetten");
      } else {
        router.replace("/m");
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  if (fase === "welkom") {
    return (
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">Markthal HQ</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            {t("login.welcome_choice_title")}
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            {t("login.welcome_choice_intro")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setFase("email")}
            className="w-full py-4 rounded-[12px] text-left px-4 transition-all"
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--hairline)",
              color: "var(--text)",
            }}
          >
            <p className="text-[15px] font-semibold">{t("login.welcome_signin")}</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
              {t("login.welcome_signin_sub")}
            </p>
          </button>
          <button
            onClick={() => router.push("/m/registreren")}
            className="w-full py-4 rounded-[12px] text-left px-4 text-white"
            style={{ background: "#30B26F" }}
          >
            <p className="text-[15px] font-semibold">{t("login.welcome_signup")}</p>
            <p className="text-[12px] mt-0.5 opacity-90">
              {t("login.welcome_signup_sub")}
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (fase === "email") {
    return (
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <button
            onClick={() => setFase("welkom")}
            className="mb-3 text-[12px] inline-flex"
            style={{ color: "var(--muted)" }}
          >
            {t("login.back")}
          </button>
          <p className="eyebrow mb-2">Markthal HQ</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            {t("login.employee_title")}
          </h1>
        </div>
        <label className="eyebrow block mb-1.5">{t("login.email_label")}</label>
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
          placeholder={t("login.email_placeholder")}
        />
        {fout && (
          <p className="mt-3 text-[13px]" style={{ color: "#E5484D" }}>{fout}</p>
        )}
        <button
          onClick={emailDoor}
          className="w-full mt-4 py-3 rounded-[10px] text-[15px] font-semibold text-white"
          style={{ background: "#0A84FF" }}
        >
          {t("common.next")}
        </button>
        <p className="text-center text-[12px] mt-6" style={{ color: "var(--muted)" }}>
          Nog geen account?{" "}
          <a href="/m/registreren" className="underline" style={{ color: "var(--text-2)" }}>
            Registreren
          </a>
        </p>
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
          {t("login.enter_pin")}
        </h1>
        <button
          onClick={() => { setFase("email"); setPin(""); setFout(null); }}
          className="mt-3 text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          {t("login.other_email")}
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
