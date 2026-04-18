"use client";

import { useState, useEffect } from "react";

const PIN = "2026";
const STORAGE_KEY = "sg_auth";

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
      if (nieuw === PIN) {
        sessionStorage.setItem(STORAGE_KEY, "1");
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

  if (checking) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] p-8">
      <div className="mb-8 text-center">
        <p className="text-white/30 text-sm uppercase tracking-widest mb-2">Studio Goud</p>
        <h1 className="text-2xl font-bold text-white">Voer PIN in</h1>
      </div>

      {/* Bolletjes */}
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              fout
                ? "border-red-400 bg-red-400"
                : i < input.length
                ? "border-white bg-white"
                : "border-white/30 bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {["1","2","3","4","5","6","7","8","9"].map((c) => (
          <button
            key={c}
            onClick={() => drukOp(c)}
            className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xl font-semibold transition-colors"
          >
            {c}
          </button>
        ))}
        <div /> {/* lege plek */}
        <button
          onClick={() => drukOp("0")}
          className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xl font-semibold transition-colors"
        >
          0
        </button>
        <button
          onClick={wis}
          className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 text-lg transition-colors"
        >
          ⌫
        </button>
      </div>

      {fout && (
        <p className="mt-6 text-red-400 text-sm animate-pulse">Onjuiste PIN</p>
      )}
    </div>
  );
}
