"use client";

/**
 * Paneel voor owner/manager waarin gereserveerde ruilverzoeken te zien zijn.
 * Per regel: aanvrager, overnemer, dienst-details — plus Goedkeuren / Weigeren.
 *
 * Bij goedkeuren wijzigt het rooster automatisch (medewerker_id van die
 * dienst wordt de overnemer). Beide partijen krijgen push.
 */
import { useEffect, useState } from "react";

interface Verzoek {
  id: number;
  status: string;
  toelichting: string | null;
  aangemaaktOp: string;
  dienst: {
    rosterId: number;
    datum: string;
    start: string;
    eind: string;
    vestiging: { slug: string; naam: string; hex: string };
  };
  aanvrager: { id: number; naam: string };
  overnemer: { id: number; naam: string } | null;
}

interface Props { hex: string }

function nlDatum(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default function RuilverzoekenBeoordelen({ hex }: Props) {
  const [verzoeken, setVerzoeken] = useState<Verzoek[] | null>(null);
  const [bezigId, setBezigId] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function laad() {
    try {
      const res = await fetch("/api/admin/ruilverzoek", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { verzoeken: Verzoek[] };
      setVerzoeken(data.verzoeken);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    }
  }

  useEffect(() => {
    laad();
    const id = setInterval(laad, 30_000);
    return () => clearInterval(id);
  }, []);

  async function beoordeel(verzoekId: number, actie: "goedkeuren" | "weigeren") {
    let notitie: string | undefined;
    if (actie === "weigeren") {
      const reden = prompt("Reden voor weigering (optioneel):") ?? "";
      notitie = reden.trim() || undefined;
    }
    setBezigId(verzoekId);
    setFout(null);
    try {
      const res = await fetch(`/api/admin/ruilverzoek/${verzoekId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie, notitie }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezigId(null);
    }
  }

  if (!verzoeken) return null;
  // Geen sectie tonen als er niets te doen is — anders neemt 'ie ruimte in.
  if (verzoeken.length === 0 && !fout) return null;

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--bg-elev)", border: `2px solid #E0A82E` }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
          ⏳ Ruilverzoeken in afwachting
        </h3>
        <span className="text-[11px] font-semibold" style={{ color: "#E0A82E" }}>
          {verzoeken.length} open
        </span>
      </div>

      {fout && (
        <p className="text-[12px] mb-3" style={{ color: "#E5484D" }}>{fout}</p>
      )}

      <div className="space-y-2">
        {verzoeken.map((v) => (
          <div
            key={v.id}
            className="rounded-xl p-3"
            style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
          >
            <div className="flex items-start gap-3 mb-2">
              <span
                className="w-1 self-stretch rounded-full"
                style={{ background: v.dienst.vestiging.hex }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px]" style={{ color: "var(--text)" }}>
                  <strong>{v.overnemer?.naam ?? "?"}</strong> wil de dienst van <strong>{v.aanvrager.naam}</strong> overnemen
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {nlDatum(v.dienst.datum)} · {v.dienst.start}–{v.dienst.eind} · {v.dienst.vestiging.naam}
                </p>
                {v.toelichting && (
                  <p className="text-[11px] mt-1 italic" style={{ color: "var(--text-2)" }}>
                    "{v.toelichting}"
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => beoordeel(v.id, "weigeren")}
                disabled={bezigId === v.id}
                className="flex-1 py-2 rounded-lg text-[12px] disabled:opacity-50"
                style={{
                  background: "transparent",
                  color: "var(--text-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                ✕ Weigeren
              </button>
              <button
                onClick={() => beoordeel(v.id, "goedkeuren")}
                disabled={bezigId === v.id}
                className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "#30B26F" }}
              >
                {bezigId === v.id ? "Bezig…" : "✓ Goedkeuren"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-3" style={{ color: "var(--muted)" }}>
        Bij goedkeuren wijzigt het rooster automatisch. Beide medewerkers krijgen een notificatie.
      </p>
    </section>
  );
}
