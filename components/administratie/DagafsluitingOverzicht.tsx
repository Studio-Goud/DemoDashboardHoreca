"use client";

/**
 * Owner/manager-overzicht van dagafsluitingen.
 * - Manager ziet alleen z'n eigen vestiging
 * - Owner ziet alles (kan filteren via prop bedrijf)
 * - Per rij: ✓ controle-status, kas-verschil (rood bij > €2), temperaturen-issues
 * - Klik op rij → detail-sheet met alle velden
 * - "Markeer gecontroleerd" knop locked de dagafsluiting voor wijziging
 */
import { useEffect, useState } from "react";

interface Item {
  id: number;
  datum: string;
  vestiging: { slug: string; naam: string; hex: string };
  ingediendDoor: string | null;
  ingediendOp: string;
  contantGeteld: number;
  enveloppe: number;
  kasVerschil: number | null;
  verschilToelichting: string | null;
  posOmzetTotaal: number | null;
  alleSchoonmaakVoltooid: boolean;
  enveloppeInKluis: boolean;
  gecontroleerdDoor: string | null;
  gecontroleerdOp: string | null;
  temperaturen: Array<{ locatie: string; waardeC: number; opmerking?: string }>;
  schoonmaakChecks: Array<{ label: string; gedaan: boolean }>;
  notitie: string | null;
}

interface Props { hex: string }

function nlDatumKort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default function DagafsluitingOverzicht({ hex }: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [bezigId, setBezigId] = useState<number | null>(null);

  async function laad() {
    try {
      const res = await fetch("/api/admin/dagafsluiting?dagen=30", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { verzoeken: Item[] };
      setItems(data.verzoeken);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    }
  }

  useEffect(() => { laad(); }, []);

  async function markeer(id: number) {
    const notitie = prompt("Notitie (optioneel):") ?? "";
    setBezigId(id);
    try {
      const res = await fetch(`/api/admin/dagafsluiting/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notitie: notitie.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setDetail(null);
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezigId(null);
    }
  }

  if (!items) return null;

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
          🧹 Dagafsluitingen
        </h3>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          laatste 30 dagen
        </span>
      </div>

      {fout && <p className="text-[12px] mb-2" style={{ color: "#E5484D" }}>{fout}</p>}

      {items.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Nog geen dagafsluitingen ontvangen.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => {
            const verschilGroot = i.kasVerschil !== null && Math.abs(i.kasVerschil) > 2;
            const tempOver = i.temperaturen.some((t) => t.waardeC > 7);
            const ok = !verschilGroot && !tempOver && i.alleSchoonmaakVoltooid && i.enveloppeInKluis;
            return (
              <button
                key={i.id}
                onClick={() => setDetail(i)}
                className="w-full text-left rounded-xl p-2.5"
                style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-1 self-stretch rounded-full" style={{ background: i.vestiging.hex }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
                      {nlDatumKort(i.datum)} · {i.vestiging.naam}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {i.ingediendDoor ?? "?"} · envelop €{i.enveloppe.toFixed(2)}
                      {i.kasVerschil !== null && (
                        <>
                          {" "}· verschil{" "}
                          <span style={{ color: verschilGroot ? "#E5484D" : "#30B26F" }}>
                            {i.kasVerschil >= 0 ? "+" : ""}€{i.kasVerschil.toFixed(2)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {verschilGroot && <span title="Groot kasverschil">💰</span>}
                    {tempOver && <span title="Temperatuur te hoog">🌡️</span>}
                    {!i.alleSchoonmaakVoltooid && <span title="Schoonmaak niet voltooid">🧹</span>}
                    {!i.enveloppeInKluis && <span title="Envelop niet in kluis">🔓</span>}
                    {ok && <span title="Alles ok">✅</span>}
                    {i.gecontroleerdDoor && <span title="Gecontroleerd">👤</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail-sheet */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-[20px] p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <DetailWeergave item={detail} hex={hex} />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDetail(null)}
                className="flex-1 py-2.5 rounded-xl text-[13px]"
                style={{
                  background: "transparent", color: "var(--text-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                Sluiten
              </button>
              {!detail.gecontroleerdDoor && (
                <button
                  onClick={() => markeer(detail.id)}
                  disabled={bezigId === detail.id}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "#30B26F" }}
                >
                  {bezigId === detail.id ? "Bezig…" : "✓ Markeer gecontroleerd"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DetailWeergave({ item, hex }: { item: Item; hex: string }) {
  return (
    <>
      <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--text)" }}>
        {nlDatumKort(item.datum)} · {item.vestiging.naam}
      </h2>
      <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>
        Ingediend door {item.ingediendDoor ?? "?"} · {new Date(item.ingediendOp).toLocaleString("nl-NL")}
        {item.gecontroleerdDoor && (
          <> · ✓ gecontroleerd door {item.gecontroleerdDoor}</>
        )}
      </p>

      <Rij label="💴 Omzet (POS)" waarde={item.posOmzetTotaal !== null ? `€${item.posOmzetTotaal.toFixed(2)}` : "—"} />
      <Rij label="💰 Contant in lade" waarde={`€${item.contantGeteld.toFixed(2)}`} />
      <Rij label="📨 Naar envelop" waarde={`€${item.enveloppe.toFixed(2)}`} hex={hex} bold />
      {item.kasVerschil !== null && (
        <Rij
          label="⚖ Verschil"
          waarde={`${item.kasVerschil >= 0 ? "+" : ""}€${item.kasVerschil.toFixed(2)}`}
          warn={Math.abs(item.kasVerschil) > 2}
        />
      )}
      {item.verschilToelichting && (
        <div className="my-2 rounded-lg p-2 text-[11px]" style={{ background: "#E5484D10", color: "var(--text-2)" }}>
          <strong>Toelichting:</strong> {item.verschilToelichting}
        </div>
      )}

      <hr className="my-3" style={{ borderColor: "var(--hairline)" }} />

      <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>🌡️ TEMPERATUREN</p>
      {item.temperaturen.length === 0 && <p className="text-[11px]" style={{ color: "var(--muted)" }}>—</p>}
      {item.temperaturen.map((t, i) => (
        <Rij key={i} label={t.locatie} waarde={`${t.waardeC.toFixed(1)}°C`} warn={t.waardeC > 7} />
      ))}

      <hr className="my-3" style={{ borderColor: "var(--hairline)" }} />

      <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>🧹 SCHOONMAAK</p>
      <ul className="space-y-0.5 mb-2">
        {item.schoonmaakChecks.map((c, i) => (
          <li key={i} className="text-[12px]" style={{ color: c.gedaan ? "var(--text)" : "var(--muted)" }}>
            {c.gedaan ? "✓" : "✕"} {c.label}
          </li>
        ))}
      </ul>
      <Rij label="Alle schoonmaak voltooid" waarde={item.alleSchoonmaakVoltooid ? "Ja" : "Nee"} warn={!item.alleSchoonmaakVoltooid} />
      <Rij label="🔒 Envelop in kluis" waarde={item.enveloppeInKluis ? "Ja" : "Nee"} warn={!item.enveloppeInKluis} />

      {item.notitie && (
        <>
          <hr className="my-3" style={{ borderColor: "var(--hairline)" }} />
          <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--muted)" }}>OPMERKING</p>
          <p className="text-[12px]" style={{ color: "var(--text-2)" }}>{item.notitie}</p>
        </>
      )}
    </>
  );
}

function Rij({ label, waarde, hex, bold, warn }: { label: string; waarde: string; hex?: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[12px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <span
        className="text-[13px] tabular-nums"
        style={{
          color: warn ? "#E5484D" : hex || "var(--text)",
          fontWeight: bold ? 600 : 400,
        }}
      >
        {waarde}
      </span>
    </div>
  );
}
