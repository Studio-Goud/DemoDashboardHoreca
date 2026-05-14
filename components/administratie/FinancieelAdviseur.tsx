"use client";

import { useState, useRef, useEffect } from "react";
import { useRol } from "@/lib/useRol";

type Slug = "bb" | "sl" | "kl";

interface Bericht {
  rol: "user" | "assistant";
  tekst: string;
  kosten?: number;
}

interface Props {
  bedrijf: Slug;
  hex: string;
}

const VOORBEELDVRAGEN = [
  "Hoe gaat het deze maand?",
  "Kan ik dit kwartaal €15.000 investeren?",
  "Waarom zijn mijn kosten zo hoog?",
  "Wat als de marathon eraan komt?",
];

/**
 * Chat met Claude Sonnet over de financiele staat van het bedrijf.
 * Owner-only — bevat winst, cashflow, DGA-info, etc.
 */
export default function FinancieelAdviseur({ bedrijf, hex }: Props) {
  const { rol } = useRol();
  const [open, setOpen] = useState(false);
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [invoer, setInvoer] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const eindRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eindRef.current) eindRef.current.scrollIntoView({ behavior: "smooth" });
  }, [berichten, bezig]);

  if (rol !== "owner") return null;

  async function stuur(tekst: string) {
    const vraag = tekst.trim();
    if (!vraag) return;
    setFout(null);
    setBezig(true);
    const nieuweBerichten: Bericht[] = [...berichten, { rol: "user", tekst: vraag }];
    setBerichten(nieuweBerichten);
    setInvoer("");

    try {
      const res = await fetch(`/api/financieel-adviseur/${bedrijf}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vraag,
          historie: berichten.map((b) => ({ rol: b.rol, tekst: b.tekst })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      setBerichten([
        ...nieuweBerichten,
        { rol: "assistant", tekst: j.antwoord, kosten: j.kosten },
      ]);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "onbekende fout");
      setBerichten(nieuweBerichten); // hou de vraag staan zodat user kan retry
    } finally {
      setBezig(false);
    }
  }

  function reset() {
    setBerichten([]);
    setFout(null);
  }

  return (
    <div className="card" style={{
      borderLeft: `3px solid #BF5AF2`,
      background: "linear-gradient(135deg, rgba(191,90,242,0.04) 0%, transparent 50%)",
    }}>
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">AI-adviseur</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            💬 Vraag de financieel adviseur
          </h3>
        </div>
        {berichten.length > 0 && (
          <button
            onClick={reset}
            className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-slate-700"
          >
            Nieuw gesprek
          </button>
        )}
      </div>

      {!open && berichten.length === 0 && (
        <>
          <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
            Claude Sonnet analyseert P&L, cashflow, loonkost en DGA en geeft onderbouwd advies.
            Ongeveer €0,03 per vraag.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {VOORBEELDVRAGEN.map((v) => (
              <button
                key={v}
                onClick={() => { setOpen(true); stuur(v); }}
                disabled={bezig}
                className="text-[11px] px-2.5 py-1.5 rounded-full transition-all disabled:opacity-50"
                style={{
                  background: "var(--bg-elev)",
                  border: "1px solid var(--hairline)",
                  color: "var(--text-2)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="w-full text-sm font-medium px-3 py-2 rounded text-white"
            style={{ background: "linear-gradient(135deg, #BF5AF2 0%, #7B2DAA 100%)" }}
          >
            ✨ Open chat
          </button>
        </>
      )}

      {(open || berichten.length > 0) && (
        <>
          <div
            className="rounded-lg p-3 mb-2 space-y-2 max-h-96 overflow-y-auto"
            style={{ background: "var(--bg)" }}
          >
            {berichten.length === 0 && (
              <p className="text-[12px] text-center py-4" style={{ color: "var(--muted)" }}>
                Stel een vraag of kies een voorbeeld hieronder.
              </p>
            )}
            {berichten.map((b, i) => (
              <div
                key={i}
                className="text-[13px] whitespace-pre-wrap"
                style={{
                  background: b.rol === "user" ? "#BF5AF21A" : "var(--bg-elev)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  border: b.rol === "user" ? "1px solid #BF5AF240" : "1px solid var(--hairline)",
                  marginLeft: b.rol === "user" ? "20%" : 0,
                  marginRight: b.rol === "user" ? 0 : "20%",
                }}
              >
                {b.tekst}
                {b.kosten !== undefined && (
                  <p className="text-[9px] mt-1 opacity-50">{`€${b.kosten.toFixed(3)}`}</p>
                )}
              </div>
            ))}
            {bezig && (
              <div className="text-[12px] italic" style={{ color: "var(--muted)" }}>
                Claude denkt na…
              </div>
            )}
            <div ref={eindRef} />
          </div>

          {fout && <p className="text-[11px] mb-2" style={{ color: "#E5484D" }}>Fout: {fout}</p>}

          <div className="flex gap-2">
            <input
              type="text"
              value={invoer}
              onChange={(e) => setInvoer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !bezig) stuur(invoer);
              }}
              placeholder="Stel een vraag…"
              disabled={bezig}
              className="flex-1 text-sm border border-slate-200 rounded px-3 py-2 bg-white"
            />
            <button
              onClick={() => stuur(invoer)}
              disabled={bezig || invoer.trim().length < 3}
              className="text-sm font-medium px-4 py-2 rounded text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #BF5AF2 0%, #7B2DAA 100%)" }}
            >
              {bezig ? "…" : "Vraag"}
            </button>
          </div>

          {/* Voorbeeldvragen tijdens chat */}
          {berichten.length > 0 && !bezig && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VOORBEELDVRAGEN.slice(0, 3).map((v) => (
                <button
                  key={v}
                  onClick={() => stuur(v)}
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{
                    background: "var(--bg-elev)",
                    border: "1px solid var(--hairline)",
                    color: "var(--muted)",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
