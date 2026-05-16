"use client";

/**
 * Inbox voor ruilverzoeken in het medewerker-dashboard.
 *
 * Drie groepen:
 *   1. "Open in jouw vestiging" — collega's zoeken een ruilpartner. Knop:
 *      "Ik neem 'm over" → status 'gereserveerd', manager moet goedkeuren.
 *   2. "Jouw eigen aanvragen" — wat ik zelf heb uitstaan + actuele status.
 *   3. Verlopen / gesloten verzoeken zien we niet (oud rooster filtert ze
 *      al weg op server).
 *
 * Auto-poll elke 30s zodat status-veranderingen zichtbaar zijn.
 */
import { useEffect, useState } from "react";

interface Verzoek {
  id: number;
  status: "open" | "gereserveerd" | "goedgekeurd" | "geweigerd" | "ingetrokken" | "verlopen";
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

function nlDatum(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const STATUS_LABEL: Record<Verzoek["status"], { tekst: string; kleur: string }> = {
  open:          { tekst: "Open", kleur: "#0A84FF" },
  gereserveerd:  { tekst: "Wacht op manager", kleur: "#E0A82E" },
  goedgekeurd:   { tekst: "Goedgekeurd", kleur: "#30B26F" },
  geweigerd:     { tekst: "Geweigerd", kleur: "#E5484D" },
  ingetrokken:   { tekst: "Ingetrokken", kleur: "#9CA3AF" },
  verlopen:      { tekst: "Verlopen", kleur: "#9CA3AF" },
};

export default function RuilverzoekenInbox() {
  const [verzoeken, setVerzoeken] = useState<Verzoek[]>([]);
  const [eigenId, setEigenId] = useState<number | null>(null);
  const [bezigId, setBezigId] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);

  async function laad() {
    try {
      const res = await fetch("/api/medewerker/ruilverzoek", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { verzoeken: Verzoek[]; eigenId: number };
      setVerzoeken(data.verzoeken);
      setEigenId(data.eigenId);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setGeladen(true);
    }
  }

  useEffect(() => {
    laad();
    const id = setInterval(laad, 30_000);
    return () => clearInterval(id);
  }, []);

  async function neemOver(verzoekId: number) {
    setBezigId(verzoekId);
    setFout(null);
    try {
      const res = await fetch(`/api/medewerker/ruilverzoek/${verzoekId}/overnemen`, { method: "POST" });
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

  async function trekIn(verzoekId: number) {
    if (!confirm("Weet je zeker dat je dit ruilverzoek wilt intrekken?")) return;
    setBezigId(verzoekId);
    try {
      const res = await fetch(`/api/medewerker/ruilverzoek/${verzoekId}/intrekken`, { method: "DELETE" });
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

  if (!geladen) return null;
  if (verzoeken.length === 0 && !fout) return null;

  const openInVestiging = verzoeken.filter(
    (v) => v.status === "open" && v.aanvrager.id !== eigenId,
  );
  const eigenVerzoeken = verzoeken.filter((v) => v.aanvrager.id === eigenId);

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
    >
      <h3 className="text-[15px] font-semibold mb-3" style={{ color: "var(--text)" }}>
        Ruilverzoeken
      </h3>
      {fout && (
        <p className="text-[12px] mb-3" style={{ color: "#E5484D" }}>{fout}</p>
      )}

      {openInVestiging.length > 0 && (
        <div className="mb-4">
          <p className="eyebrow mb-2">Collega's zoeken een ruilpartner</p>
          <div className="space-y-2">
            {openInVestiging.map((v) => (
              <div
                key={v.id}
                className="rounded-xl p-3"
                style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-1 self-stretch rounded-full"
                    style={{ background: v.dienst.vestiging.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
                      <strong>{v.aanvrager.naam}</strong> · {nlDatum(v.dienst.datum)}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {v.dienst.start}–{v.dienst.eind} · {v.dienst.vestiging.naam}
                    </p>
                    {v.toelichting && (
                      <p className="text-[12px] mt-1.5 italic" style={{ color: "var(--text-2)" }}>
                        "{v.toelichting}"
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => neemOver(v.id)}
                  disabled={bezigId === v.id}
                  className="w-full mt-3 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "#30B26F" }}
                >
                  {bezigId === v.id ? "Bezig…" : "✓ Ik neem 'm over"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {eigenVerzoeken.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Jouw aanvragen</p>
          <div className="space-y-2">
            {eigenVerzoeken.map((v) => {
              const label = STATUS_LABEL[v.status];
              return (
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
                      <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
                        {nlDatum(v.dienst.datum)} · {v.dienst.start}–{v.dienst.eind}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        {v.dienst.vestiging.naam}
                      </p>
                      {v.overnemer && (
                        <p className="text-[12px] mt-1" style={{ color: "var(--text-2)" }}>
                          {v.status === "goedgekeurd" ? "Overgenomen door" : "Wordt overgenomen door"}: <strong>{v.overnemer.naam}</strong>
                        </p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: label.kleur, color: "#fff" }}
                    >
                      {label.tekst}
                    </span>
                  </div>
                  {(v.status === "open" || v.status === "gereserveerd") && (
                    <button
                      onClick={() => trekIn(v.id)}
                      disabled={bezigId === v.id}
                      className="text-[11px] underline"
                      style={{ color: "var(--muted)" }}
                    >
                      Intrekken
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
