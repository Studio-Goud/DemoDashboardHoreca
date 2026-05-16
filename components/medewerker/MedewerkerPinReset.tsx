"use client";

/**
 * Verplicht PIN-reset scherm. Komt na een bulk-geseede login met PIN "1234".
 * UI mirror van de PIN-stap uit `MedewerkerRegistratieFlow.tsx`: bevestiging
 * in twee stappen (kies + herhaal) en weigert expliciet "1234" — anders zou
 * de moet_pin_resetten vlag wissen zonder werkelijke verandering.
 *
 * Na succes: sessionStorage flag `sg_mw_via_pin` (zodat de FaceID-prompt
 * weet dat 'ie mag verschijnen) + redirect naar /m.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Stap = "kies" | "herhaal";

interface Props { voornaam: string }

export default function MedewerkerPinReset({ voornaam }: Props) {
  const router = useRouter();
  const [stap, setStap] = useState<Stap>("kies");
  const [pin, setPin] = useState("");
  const [bevestiging, setBevestiging] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const huidig = stap === "kies" ? pin : bevestiging;

  function druk(c: string) {
    if (bezig) return;
    if (huidig.length >= 4) return;
    const nieuw = huidig + c;
    if (stap === "kies") setPin(nieuw);
    else setBevestiging(nieuw);
    setFout(null);
    if (nieuw.length === 4) {
      if (stap === "kies") {
        // Default-PIN expliciet weigeren in de UI — server check is leading.
        if (nieuw === "1234") {
          setFout("Kies een andere PIN dan 1234");
          setPin("");
          return;
        }
        setTimeout(() => setStap("herhaal"), 200);
      } else {
        if (nieuw !== pin) {
          setFout("PINs komen niet overeen — probeer opnieuw");
          setBevestiging("");
          setPin("");
          setStap("kies");
          return;
        }
        opslaan(nieuw);
      }
    }
  }

  function wis() {
    if (bezig) return;
    setFout(null);
    if (stap === "kies") setPin((p) => p.slice(0, -1));
    else setBevestiging((p) => p.slice(0, -1));
  }

  async function opslaan(nieuwePin: string) {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/medewerker/pin-instellen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: nieuwePin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "opslaan mislukt");
      }
      // Flag voor de Face ID-prompt: gebruiker kwam binnen via PIN.
      sessionStorage.setItem("sg_mw_via_pin", "1");
      router.replace("/m");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
      setPin("");
      setBevestiging("");
      setStap("kies");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="max-w-sm w-full">
      <div className="text-center mb-8">
        <p className="eyebrow mb-2">Welkom {voornaam}</p>
        <h1
          className="text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
        >
          {stap === "kies" ? "Kies je eigen PIN" : "Herhaal je PIN"}
        </h1>
        <p className="text-[13px] mt-2 max-w-[280px] mx-auto" style={{ color: "var(--muted)" }}>
          {stap === "kies"
            ? "4 cijfers — anders dan 1234. Gebruik je deze PIN voortaan om in te loggen."
            : "Tik dezelfde 4 cijfers nog een keer om te bevestigen."}
        </p>
      </div>

      <div className="flex justify-center gap-3.5 mb-10">
        {[0, 1, 2, 3].map((i) => {
          const filled = i < huidig.length;
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
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
          <button
            key={c}
            disabled={bezig}
            onClick={() => druk(c)}
            className="h-16 rounded-full text-[22px] font-light transition-colors disabled:opacity-40"
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
          disabled={bezig}
          onClick={() => druk("0")}
          className="h-16 rounded-full text-[22px] font-light disabled:opacity-40"
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline)",
            color: "var(--text)",
          }}
        >
          0
        </button>
        <button
          disabled={bezig}
          onClick={wis}
          className="h-16 rounded-full text-[14px] disabled:opacity-40"
          style={{ color: "var(--muted)" }}
          aria-label="Wissen"
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
