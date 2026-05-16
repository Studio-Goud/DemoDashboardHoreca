"use client";

import { useState } from "react";

interface Props {
  rosterId: number;
  dienstLabel: string;          // "Dinsdag 16 mei · 17:00-22:00 · Brunch & Brew"
  hex: string;
  onAfsluiten: () => void;
  onSucces: () => void;
}

export default function RuilverzoekModal({ rosterId, dienstLabel, hex, onAfsluiten, onSucces }: Props) {
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function verstuur() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/medewerker/ruilverzoek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterId,
          toelichting: toelichting.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onSucces();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onAfsluiten}
    >
      <div
        className="w-full max-w-sm rounded-[20px] p-6 shadow-2xl"
        style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--text)" }}>
          Ruilverzoek versturen
        </h2>
        <p className="text-[13px] mb-1" style={{ color: "var(--muted)" }}>
          Je collega's in dezelfde vestiging krijgen een push-notificatie.
        </p>
        <p className="text-[12px] font-medium mb-4" style={{ color: "var(--text-2)" }}>
          {dienstLabel}
        </p>

        <label className="text-[11px] block mb-1" style={{ color: "var(--muted)" }}>
          Toelichting (optioneel)
        </label>
        <textarea
          value={toelichting}
          onChange={(e) => setToelichting(e.target.value)}
          placeholder="Bv. 'Heb tandartsafspraak — kan iemand overnemen?'"
          maxLength={280}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl text-[14px] resize-none"
          style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text)" }}
        />

        {fout && (
          <p className="text-[12px] mt-3" style={{ color: "#E5484D" }}>{fout}</p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onAfsluiten}
            disabled={bezig}
            className="flex-1 py-3 rounded-xl text-[14px]"
            style={{
              background: "transparent",
              color: "var(--text-2)",
              border: "1px solid var(--hairline)",
            }}
          >
            Annuleer
          </button>
          <button
            onClick={verstuur}
            disabled={bezig}
            className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white disabled:opacity-60"
            style={{ background: hex }}
          >
            {bezig ? "Versturen…" : "Verstuur"}
          </button>
        </div>
        <p className="text-[10px] text-center mt-3" style={{ color: "var(--muted)" }}>
          Max 1 verzoek per uur. Manager moet de uiteindelijke ruil goedkeuren.
        </p>
      </div>
    </div>
  );
}
