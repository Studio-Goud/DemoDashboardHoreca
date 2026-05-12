"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PIN_NAMEN: Record<string, string> = {
  "2026": "Ricardo",
  "2580": "Matthieu",
};

const USER_STANDAARD: Record<string, string> = {
  Ricardo: "/bb",
  Matthieu: "/kl",
};

const STORAGE_KEY = "sg_auth";
const USER_KEY = "sg_user";

export default function PinGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
        sessionStorage.setItem("sg_welkom_pending", naam);
        window.dispatchEvent(
          new CustomEvent("sg:welkom", { detail: { naam } })
        );
        setUnlocked(true);
        router.replace(USER_STANDAARD[naam] ?? "/bb");
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
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{
            border: "2px solid var(--hairline)",
            borderTopColor: "var(--text-2)",
          }}
        />
      </div>
    );
  }
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-2">Studio Goud</p>
        <h1
          className="text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
        >
          Voer PIN in
        </h1>
      </div>

      <div className="flex gap-3.5 mb-10">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < input.length;
          return (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-150"
              style={{
                background: fout
                  ? "#E5484D"
                  : filled
                  ? "var(--text)"
                  : "transparent",
                border: `1.5px solid ${
                  fout ? "#E5484D" : filled ? "var(--text)" : "var(--hairline)"
                }`,
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 w-64">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
          <button
            key={c}
            onClick={() => drukOp(c)}
            className="h-16 rounded-full text-[22px] font-light transition-colors"
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--hairline)",
              color: "var(--text)",
            }}
          >
            {c}
          </button>
        ))}
        <div />
        <button
          onClick={() => drukOp("0")}
          className="h-16 rounded-full text-[22px] font-light transition-colors"
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline)",
            color: "var(--text)",
          }}
        >
          0
        </button>
        <button
          onClick={wis}
          className="h-16 rounded-full text-[14px] transition-colors flex items-center justify-center"
          style={{ color: "var(--muted)" }}
          aria-label="Wissen"
        >
          ⌫
        </button>
      </div>

      {fout && (
        <p className="mt-6 text-[13px]" style={{ color: "#E5484D" }}>
          Onjuiste PIN
        </p>
      )}
    </div>
  );
}
