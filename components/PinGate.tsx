"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Icon from "./Icon";

// 4-cijferige PIN → identiteit + rol
// - owners hebben een vaste vestiging
// - manager-PIN is gedeeld; vestiging wordt na PIN-invoer gekozen
const PIN_PROFIEL: Record<
  string,
  { naam: string; rol: "owner" | "manager"; vestiging?: "bb" | "sl" | "kl" }
> = {
  "2026": { naam: "Ricardo",  rol: "owner",   vestiging: "bb" },
  "2580": { naam: "Matthieu", rol: "owner",   vestiging: "kl" },
  "2222": { naam: "Manager",  rol: "manager" },
};

const STORAGE_KEY  = "sg_auth";
const USER_KEY     = "sg_user";
const ROL_KEY      = "sg_rol";
const VESTIGING_KEY = "sg_vestiging";

const VESTIGING_OPTIES = [
  { slug: "bb" as const, naam: "Brunch & Brew",  accent: "#0A84FF" },
  { slug: "sl" as const, naam: "Saté Lounge",    accent: "#30B26F" },
  { slug: "kl" as const, naam: "Het Kroket Loket", accent: "#E07A1F" },
];

export default function PinGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [fout, setFout] = useState(false);
  const [checking, setChecking] = useState(true);
  // Fase: "rolKiezen" (default) → "pin" → eventueel "vestigingKiezen" (manager)
  const [fase, setFase] = useState<"rolKiezen" | "pin" | "vestigingKiezen">("rolKiezen");

  // /m/* en /welkom* hebben eigen authenticatie (medewerker-sessie via cookie),
  // dus PinGate moet die routes ongemoeid doorlaten.
  const isMedewerkerRoute = pathname.startsWith("/m") || pathname.startsWith("/welkom");

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
    setChecking(false);
  }, []);

  function voltooidInloggen(profiel: typeof PIN_PROFIEL[string], vestiging: "bb" | "sl" | "kl") {
    sessionStorage.setItem(STORAGE_KEY, "1");
    sessionStorage.setItem(USER_KEY, profiel.naam);
    sessionStorage.setItem(ROL_KEY, profiel.rol);
    sessionStorage.setItem(VESTIGING_KEY, vestiging);
    sessionStorage.setItem("sg_welkom_pending", profiel.naam);
    window.dispatchEvent(new CustomEvent("sg:welkom", { detail: { naam: profiel.naam } }));
    setUnlocked(true);
    router.replace(`/${vestiging}`);
  }

  function drukOp(cijfer: string) {
    if (input.length >= 4) return;
    const nieuw = input + cijfer;
    setInput(nieuw);
    setFout(false);

    if (nieuw.length === 4) {
      const profiel = PIN_PROFIEL[nieuw];
      if (!profiel) {
        setFout(true);
        setTimeout(() => setInput(""), 600);
        return;
      }
      if (profiel.rol === "manager") {
        // Manager moet nog vestiging kiezen
        setFase("vestigingKiezen");
        return;
      }
      // Owner: meteen door
      voltooidInloggen(profiel, profiel.vestiging ?? "bb");
    }
  }

  function wis() {
    setInput((v) => v.slice(0, -1));
    setFout(false);
  }

  function kiesVestiging(slug: "bb" | "sl" | "kl") {
    const profiel = PIN_PROFIEL[input];
    if (!profiel) return;
    voltooidInloggen(profiel, slug);
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
  // Medewerker-routes: PinGate niet tonen — die hebben eigen sessie via cookie
  if (isMedewerkerRoute) return <>{children}</>;

  // Fase 0: rol-keuze (Medewerker / Management)
  if (fase === "rolKiezen") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-2">Studio Goud</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            Wie ben jij?
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            Kies je rol om in te loggen.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-72">
          <button
            onClick={() => router.push("/m/login")}
            className="group px-5 py-5 rounded-[16px] text-left transition-all relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(48, 178, 111, 0.12) 0%, rgba(48, 178, 111, 0.04) 100%)",
              border: "1px solid rgba(48, 178, 111, 0.35)",
              boxShadow: "inset 0 0 0 1px rgba(48, 178, 111, 0.10), 0 4px 20px -8px rgba(48, 178, 111, 0.30)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] shrink-0"
                style={{
                  background: "linear-gradient(135deg, #30B26F 0%, #1F7A4E 100%)",
                  color: "#fff",
                  boxShadow: "0 0 18px -4px rgba(48,178,111,0.6)",
                }}
              >
                <Icon name="user" size={22} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                  Medewerker
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Eigen rooster, klokken, beschikbaarheid
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFase("pin")}
            className="group px-5 py-5 rounded-[16px] text-left transition-all relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(10, 132, 255, 0.12) 0%, rgba(10, 132, 255, 0.04) 100%)",
              border: "1px solid rgba(10, 132, 255, 0.35)",
              boxShadow: "inset 0 0 0 1px rgba(10, 132, 255, 0.10), 0 4px 20px -8px rgba(10, 132, 255, 0.30)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] shrink-0"
                style={{
                  background: "linear-gradient(135deg, #0A84FF 0%, #0B5FBF 100%)",
                  color: "#fff",
                  boxShadow: "0 0 18px -4px rgba(10,132,255,0.6)",
                }}
              >
                <Icon name="trending-up" size={22} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                  Management
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Dashboard, omzet, rooster bewerken
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (fase === "vestigingKiezen") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-2">Manager</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            Welke vestiging beheer je?
          </h1>
        </div>

        <div className="flex flex-col gap-3 w-72">
          {VESTIGING_OPTIES.map((v) => (
            <button
              key={v.slug}
              onClick={() => kiesVestiging(v.slug)}
              className="px-5 py-4 rounded-[12px] text-[15px] font-medium transition-all flex items-center justify-between"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--hairline)",
                color: "var(--text)",
              }}
            >
              <span>{v.naam}</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: v.accent, boxShadow: `0 0 6px ${v.accent}` }}
              />
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setFase("pin");
            setInput("");
          }}
          className="mt-8 text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          ← Terug naar PIN
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="mb-10 text-center">
        <button
          onClick={() => { setFase("rolKiezen"); setInput(""); setFout(false); }}
          className="mb-3 text-[12px] inline-flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          ← terug
        </button>
        <p className="eyebrow mb-2">Management</p>
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
