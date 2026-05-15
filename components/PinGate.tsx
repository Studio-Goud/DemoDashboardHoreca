"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Icon from "./Icon";
import { useT } from "@/lib/i18n/useT";
import { startAuthentication } from "@simplewebauthn/browser";
import FaceIDPromptModal from "./FaceIDPromptModal";

// PIN_PROFIEL leeft NU ALLEEN server-side in lib/admin-auth.ts. We sturen
// de PIN naar /api/admin/login en de server vertelt ons rol/naam/vestiging.
// Eerder zat 'm in dit client-bestand en stond 'ie zo in de JS-bundle voor
// alle bezoekers — DevTools toonde alle admin-PINs in plaintext.

interface ServerSessieInfo {
  rol: "owner" | "manager";
  naam: string;
  vestiging: "bb" | "sl" | "kl" | null;
}

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
  const { t } = useT();
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [fout, setFout] = useState(false);
  const [checking, setChecking] = useState(true);
  // Fase: "rolKiezen" (default) → "pin" → eventueel "vestigingKiezen" (manager)
  const [fase, setFase] = useState<"rolKiezen" | "pin" | "vestigingKiezen" | "faceIDBezig">("rolKiezen");
  // Welke rol verwachten we voor de PIN-invoer? Eigenaar mag NIET binnenkomen
  // met manager-PIN en omgekeerd — security door scheiding.
  const [verwachteRol, setVerwachteRol] = useState<"owner" | "manager" | null>(null);
  // Face-ID metadata na een succesvolle WebAuthn-auth (manager moet daarna
  // nog vestiging kiezen — owner gaat direct door)
  const [faceIDProfiel, setFaceIDProfiel] = useState<{ pin: string; naam: string; rol: "owner" | "manager"; vestiging: "bb" | "sl" | "kl" | null } | null>(null);
  const [faceIDFout, setFaceIDFout] = useState<string | null>(null);

  // /m/* en /welkom* hebben eigen authenticatie (medewerker-sessie via cookie),
  // dus PinGate moet die routes ongemoeid doorlaten. /dev/* zijn losstaande
  // design-system / boot-sequence demo's die zonder login bereikbaar moeten zijn.
  const isMedewerkerRoute = pathname.startsWith("/m")
    || pathname.startsWith("/welkom")
    || pathname.startsWith("/dev");

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
    setChecking(false);
  }, []);

  /**
   * Zet sessionStorage + redirect — zónder /api/admin/login te roepen.
   * Gebruikt na een succesvolle Face ID auth, waar de cookie al
   * server-side is gezet door /api/auth/webauthn/auth/complete.
   *
   * `viaPin` = true → de FaceIDPromptModal mag aan deze gebruiker vragen
   * of 'ie Face ID wil instellen (eerste-keer-aanbieden flow).
   */
  function sessieAfronden(
    naam: string,
    rol: "owner" | "manager",
    vestiging: "bb" | "sl" | "kl",
    viaPin = false,
  ) {
    sessionStorage.setItem(STORAGE_KEY, "1");
    sessionStorage.setItem(USER_KEY, naam);
    sessionStorage.setItem(ROL_KEY, rol);
    sessionStorage.setItem(VESTIGING_KEY, vestiging);
    sessionStorage.setItem("sg_welkom_pending", naam);
    if (viaPin) {
      sessionStorage.setItem("sg_via_pin", "1");
    } else {
      sessionStorage.removeItem("sg_via_pin");
    }
    window.dispatchEvent(new CustomEvent("sg:welkom", { detail: { naam } }));
    setUnlocked(true);
    router.replace(`/${vestiging}`);
  }

  /**
   * Probeer Face ID login voor de gevraagde rol. Direct na de click roepen
   * we /auth/begin + startAuthentication() — iOS Safari vereist dat
   * WebAuthn-calls in dezelfde user-activation context plaatsvinden als
   * de click. Tussenliggende fetches (zoals een /has-check) kunnen dat
   * window invalideren, waardoor iOS silent NotAllowedError gooit en de
   * user denkt dat Face ID niet werkt.
   *
   * /auth/begin returnt 404 als er geen creds zijn → val terug op PIN.
   */
  async function probeerFaceID(rol: "owner" | "manager") {
    setFaceIDFout(null);
    setVerwachteRol(rol);
    setFase("faceIDBezig");

    try {
      const beginRes = await fetch("/api/auth/webauthn/auth/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol }),
      });
      if (beginRes.status === 404) {
        // Geen passkeys voor deze rol → direct PIN-pad zonder fout
        setFase("pin");
        return;
      }
      if (!beginRes.ok) throw new Error(`HTTP ${beginRes.status}`);
      const { options, sessionId } = await beginRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const completeRes = await fetch("/api/auth/webauthn/auth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, assertion }),
      });
      if (!completeRes.ok) {
        const j = await completeRes.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "auth mislukt");
      }
      const result = await completeRes.json() as {
        rol: "owner" | "manager";
        naam: string;
        vestiging: "bb" | "sl" | "kl" | null;
        pin: string;
      };

      if (result.rol === "owner" && result.vestiging) {
        sessieAfronden(result.naam, result.rol, result.vestiging);
      } else {
        setFaceIDProfiel(result);
        setFase("vestigingKiezen");
      }
    } catch (e) {
      const bericht = e instanceof Error ? e.message : "Face ID afgebroken";
      const isCancel = bericht.includes("NotAllowedError") || bericht.includes("aborted");
      console.warn("[probeerFaceID]", bericht);
      setFaceIDFout(isCancel ? null : bericht);
      setFase("pin");
    }
  }

  // Houd vast welke server-info we hebben na een succesvolle PIN-validatie
  // (zonder cookie te zetten) — gebruikt om de manager naar vestiging-keuze
  // te brengen of fouten te tonen.
  const [serverProfiel, setServerProfiel] = useState<ServerSessieInfo | null>(null);

  async function valideerPinServer(pin: string): Promise<void> {
    // Belangrijk: bij owner-PIN + verwachteRol="manager" sturen we
    // gewensteRol="manager" mee zodat de server de view-as flow doet
    // (anders zou owner direct als owner ingelogd worden).
    const gewensteRol = verwachteRol === "manager" ? "manager" : undefined;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, gewensteRol }),
      });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        setFout(true);
        alert(j.error ?? "Te veel pogingen — even wachten.");
        setTimeout(() => setInput(""), 600);
        return;
      }
      if (!res.ok) {
        setFout(true);
        setTimeout(() => setInput(""), 600);
        return;
      }
      const j = (await res.json()) as
        | { vraagVestiging: true; rol: "manager"; naam: string }
        | { ok: true; rol: "owner" | "manager"; naam: string; vestiging: "bb" | "sl" | "kl" };

      if ("vraagVestiging" in j) {
        // Manager flow — bewaar PIN voor de tweede call én ga naar de
        // vestiging-keuze. We bewaren de PIN tijdelijk in component state
        // (NIET sessionStorage — die wordt naar de server gestuurd in de
        // 2e POST en daarna weggegooid).
        setServerProfiel({ rol: j.rol, naam: j.naam, vestiging: null });
        setFase("vestigingKiezen");
        return;
      }
      // Owner flow: cookie staat, direct door.
      sessieAfronden(j.naam, j.rol, j.vestiging, true);
    } catch {
      setFout(true);
      setTimeout(() => setInput(""), 600);
    }
  }

  function drukOp(cijfer: string) {
    if (input.length >= 4) return;
    const nieuw = input + cijfer;
    setInput(nieuw);
    setFout(false);
    if (nieuw.length === 4) {
      valideerPinServer(nieuw);
    }
  }

  function wis() {
    setInput((v) => v.slice(0, -1));
    setFout(false);
  }

  async function kiesVestiging(slug: "bb" | "sl" | "kl") {
    // Twee paden naar deze keuze:
    //   a) PIN-flow: manager-PIN is succesvol ingetoetst (serverProfiel
    //      heeft de naam + rol, input heeft de PIN)
    //   b) Face ID flow: faceIDProfiel is gevuld (cookie staat al)
    if (faceIDProfiel) {
      fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: faceIDProfiel.pin, vestiging: slug }),
      }).catch(() => null);
      sessieAfronden(faceIDProfiel.naam, faceIDProfiel.rol, slug);
      return;
    }
    if (!serverProfiel) return;
    // 2e call met vestiging zodat de cookie correct gezet wordt
    const gewensteRol = verwachteRol === "manager" ? "manager" : undefined;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: input, vestiging: slug, gewensteRol }),
    });
    if (!res.ok) {
      setFout(true);
      return;
    }
    const j = await res.json() as { naam: string; rol: "owner" | "manager"; vestiging: "bb" | "sl" | "kl" };
    sessieAfronden(j.naam, j.rol, j.vestiging, true);
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
  if (unlocked) {
    // Accent op basis van geselecteerde vestiging — modal pakt 'm op
    const vestiging = typeof window !== "undefined" ? sessionStorage.getItem(VESTIGING_KEY) : null;
    const modalHex = vestiging === "sl" ? "#30B26F"
      : vestiging === "kl" ? "#E07A1F"
      : "#0A84FF";
    return (
      <>
        {children}
        <FaceIDPromptModal hex={modalHex} />
      </>
    );
  }
  // Medewerker-routes: PinGate niet tonen — die hebben eigen sessie via cookie
  if (isMedewerkerRoute) return <>{children}</>;

  // Fase 0: rol-keuze (Medewerker / Management)
  if (fase === "rolKiezen") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-2">Markthal HQ</p>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            {t("login.who_are_you")}
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            {t("login.role_intro")}
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
                  {t("login.role_employee")}
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {t("login.role_employee_sub")}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => probeerFaceID("manager")}
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
                  Dagelijkse aansturing van de vestiging
                </p>
              </div>
            </div>
          </button>

          {/* Eigenaar — purper-goud accent, scheidt zich visueel van management */}
          <button
            onClick={() => probeerFaceID("owner")}
            className="group px-5 py-5 rounded-[16px] text-left transition-all relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(191, 90, 242, 0.12) 0%, rgba(191, 90, 242, 0.04) 100%)",
              border: "1px solid rgba(191, 90, 242, 0.35)",
              boxShadow: "inset 0 0 0 1px rgba(191, 90, 242, 0.10), 0 4px 20px -8px rgba(191, 90, 242, 0.30)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] shrink-0"
                style={{
                  background: "linear-gradient(135deg, #BF5AF2 0%, #7B2DAA 100%)",
                  color: "#fff",
                  boxShadow: "0 0 18px -4px rgba(191,90,242,0.6)",
                }}
              >
                <Icon name="lock" size={22} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                  Eigenaar
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Volledige toegang incl. administratie + salaris
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

  if (fase === "faceIDBezig") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-2" style={{ color: verwachteRol === "owner" ? "#BF5AF2" : "#0A84FF" }}>
            {verwachteRol === "owner" ? "Eigenaar" : "Management"}
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.019em" }}>
            Face ID / Touch ID
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
            Bevestig je identiteit op je apparaat
          </p>
        </div>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
          <div className="w-6 h-6 rounded-full animate-pulse" style={{ background: verwachteRol === "owner" ? "#BF5AF2" : "#0A84FF" }} />
        </div>
        <button
          onClick={() => setFase("pin")}
          className="text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          Code invoeren in plaats daarvan
        </button>
      </div>
    );
  }

  // PIN-scherm: voor zowel manager als eigenaar. Eyebrow toont welke rol
  // verwacht wordt zodat de gebruiker weet dat hij/zij de juiste PIN moet
  // intoetsen.
  const pinEyebrow = verwachteRol === "owner" ? "Eigenaar" : t("login.management_label");
  const pinAccent  = verwachteRol === "owner" ? "#BF5AF2" : undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="mb-10 text-center">
        <button
          onClick={() => { setFase("rolKiezen"); setInput(""); setFout(false); setVerwachteRol(null); }}
          className="mb-3 text-[12px] inline-flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          {t("login.back")}
        </button>
        <p className="eyebrow mb-2" style={pinAccent ? { color: pinAccent } : undefined}>
          {pinEyebrow}
        </p>
        <h1
          className="text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
        >
          {t("login.title")}
        </h1>
        {faceIDFout && (
          <p className="text-[11px] mt-2" style={{ color: "#E07A1F" }}>
            Face ID: {faceIDFout}
          </p>
        )}
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
