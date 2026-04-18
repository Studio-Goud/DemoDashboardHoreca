"use client";

import { useState, useEffect } from "react";

const PIN_NAMEN: Record<string, string> = {
  "2026": "Ricardo",
  "2580": "Matthieu",
};

const STORAGE_KEY = "sg_auth";
const USER_KEY = "sg_user";

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [fout, setFout] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
    setChecking(false);
  }, []);

  function drukOp(cijfer: string) {
    if (input.length >= 4) return;
    const nieuw = input + cijfer;
    setInput(nieuw);
    setFout(false);

    if (nieuw.length === 4) {
      const naam = PIN_NAMEN[nieuw];
      if (naam) {
        sessionStorage.setItem(STORAGE_KEY, "1");
        sessionStorage.setItem(USER_KEY, naam);
        // Trigger welkom-banner via custom event zodat toast direct verschijnt
        window.dispatchEvent(
          new CustomEvent("sg:welkom", { detail: { naam } })
        );
        setUnlocked(true);
      } else {
        setFout(true);
        setTimeout(() => setInput(""), 600);
      }
    }
  }

  function wis() {
    setInput((v) => v.slice(0, -1));
    setFout(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="mb-8 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
          Omzetoverzicht
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Voer PIN in</h1>
      </div>

      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              fout
                ? "border-red-500 bg-red-500"
                : i < input.length
                ? "border-slate-900 bg-slate-900"
                : "border-slate-300 bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-64">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
          <button
            key={c}
            onClick={() => drukOp(c)}
            className="h-16 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-900 text-xl font-semibold transition-colors shadow-card"
          >
            {c}
          </button>
        ))}
        <div />
        <button
          onClick={() => drukOp("0")}
          className="h-16 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-900 text-xl font-semibold transition-colors shadow-card"
        >
          0
        </button>
        <button
          onClick={wis}
          className="h-16 rounded-2xl bg-transparent hover:bg-slate-100 text-slate-500 text-lg transition-colors"
        >
          ⌫
        </button>
      </div>

      {fout && (
        <p className="mt-6 text-red-500 text-sm animate-pulse">Onjuiste PIN</p>
      )}
    </div>
  );
}
