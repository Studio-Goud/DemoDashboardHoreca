"use client";

import { useEffect, useState, useCallback } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

interface MedewerkerRegel {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  brutoUren: number;
  uurloon: number;
  brutoLoon: number;
  vakantiegeldEur: number;
  vakantieUrenEur: number;
  totaalEur: number;
  bron: "klok" | "rooster" | "mix";
  berekenHash: string;
  dbStatus: "open" | "afgerekend" | "uitbetaald";
  hashKlopt: boolean;
}

interface OwnerRapport {
  rol: "owner";
  bedrijf: string;
  jaar: number;
  maand: number;
  perMedewerker: MedewerkerRegel[];
  totaalBrutoLoon: number;
  totaalVakantiegeld: number;
  totaalVakantieUren: number;
  totaalEur: number;
  waarschuwingen: string[];
}

interface ManagerRapport {
  rol: "manager";
  bedrijf: string;
  jaar: number;
  maand: number;
  aantalMedewerkers: number;
  totaalUren: number;
  totaalLoonkosten: number;
  gemKostPerMedewerker: number;
}

type Rapport = OwnerRapport | ManagerRapport;

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function fmtEur(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUren(n: number): string {
  return n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "u";
}

const STATUS_KLEUR: Record<MedewerkerRegel["dbStatus"], string> = {
  open: "var(--muted)",
  afgerekend: "#E07A1F",
  uitbetaald: "#30B26F",
};

const STATUS_LABEL: Record<MedewerkerRegel["dbStatus"], string> = {
  open: "open",
  afgerekend: "afgerekend",
  uitbetaald: "uitbetaald",
};

export default function SalarisPanel({ bedrijf, hex }: Props) {
  const nu = new Date();
  // Default: vorige maand (typische afrekening na maandwissel)
  const initieelJaar = nu.getMonth() === 0 ? nu.getFullYear() - 1 : nu.getFullYear();
  const initieleMaand = nu.getMonth() === 0 ? 12 : nu.getMonth();

  const [jaar, setJaar] = useState(initieelJaar);
  const [maand, setMaand] = useState(initieleMaand);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    setLoading(true);
    setFout(null);
    try {
      const res = await fetch(`/api/salaris/${bedrijf}/${jaar}/${maand}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "kon rapport niet laden");
      }
      const data = (await res.json()) as Rapport;
      setRapport(data);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
      setRapport(null);
    } finally {
      setLoading(false);
    }
  }, [bedrijf, jaar, maand]);

  useEffect(() => {
    laden();
  }, [laden]);

  function vorigeMaand() {
    if (maand === 1) { setJaar(jaar - 1); setMaand(12); }
    else setMaand(maand - 1);
  }
  function volgendeMaand() {
    if (maand === 12) { setJaar(jaar + 1); setMaand(1); }
    else setMaand(maand + 1);
  }

  async function rekenAlleAf() {
    if (!rapport || rapport.rol !== "owner") return;
    const openMedewerkers = rapport.perMedewerker.filter((r) => r.dbStatus === "open");
    if (openMedewerkers.length === 0) {
      alert("Geen open posten om af te rekenen.");
      return;
    }
    if (!confirm(`${openMedewerkers.length} medewerker(s) bevriezen op de huidige bedragen voor ${MAANDEN[maand - 1]} ${jaar}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/salaris/${bedrijf}/${jaar}/${maand}/afrekenen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "afrekenen mislukt");
      }
      await laden();
    } catch (e) {
      alert(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  async function markeerUitbetaald(medewerkerId: number, naam: string) {
    const ref = prompt(`Bank-referentie voor ${naam} (bv. SEPA-batch ID of TX-code):`);
    if (!ref) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/salaris/${bedrijf}/${jaar}/${maand}/uitbetalen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medewerkerId, betalingReferentie: ref }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "markeer-uitbetaald mislukt");
      }
      await laden();
    } catch (e) {
      alert(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    window.open(`/api/salaris/${bedrijf}/${jaar}/${maand}?format=csv`, "_blank");
  }

  return (
    <>
      <LoadingOverlay
        zichtbaar={busy}
        titel="Salaris bijwerken"
        subtitel="Bezig met berekenen en opslaan van de salaris-periode"
        accent={hex}
        toonTimer
      />
    <div className="card">
      {/* Header + maand-navigatie */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="eyebrow">Salaris</p>
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            {MAANDEN[maand - 1]} {jaar}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="segmented">
            <button onClick={vorigeMaand} className="segmented-item" aria-label="Vorige maand" disabled={busy}>‹</button>
            <button onClick={laden} className="segmented-item" disabled={busy}>↻</button>
            <button onClick={volgendeMaand} className="segmented-item" aria-label="Volgende maand" disabled={busy}>›</button>
          </div>
          {rapport?.rol === "owner" && (
            <button
              onClick={downloadCsv}
              className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            >
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Waarschuwingen (hash-mismatch op afgerekende periodes) — owner-only */}
      {rapport && rapport.rol === "owner" && rapport.waarschuwingen.length > 0 && (
        <div className="rounded-[8px] p-3 mb-3" style={{ background: "rgba(229,72,77,0.10)", border: "1px solid rgba(229,72,77,0.30)" }}>
          <p className="text-[12px] font-semibold mb-1" style={{ color: "#E5484D" }}>
            Integriteit-waarschuwingen
          </p>
          {rapport.waarschuwingen.map((w: string, i: number) => (
            <p key={i} className="text-[11px]" style={{ color: "#E5484D" }}>{w}</p>
          ))}
        </div>
      )}

      {loading && (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>Laden…</p>
      )}
      {fout && (
        <p className="text-[13px]" style={{ color: "#E5484D" }}>Fout: {fout}</p>
      )}

      {/* Manager-view: alleen aggregaat-kaart, geen detail per persoon */}
      {rapport && rapport.rol === "manager" && (
        <>
          {rapport.aantalMedewerkers === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Geen gewerkte uren in {MAANDEN[maand - 1]} {jaar}.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
                <p className="eyebrow">Loonkosten totaal</p>
                <p className="text-[22px] font-semibold tabular-nums" style={{ color: hex }}>
                  {fmtEur(rapport.totaalLoonkosten)}
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  incl. vakantiegeld + vakantie-uren
                </p>
              </div>
              <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
                <p className="eyebrow">Mensen</p>
                <p className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {rapport.aantalMedewerkers}
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  unieke medewerkers gewerkt
                </p>
              </div>
              <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
                <p className="eyebrow">Totaal uren</p>
                <p className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {fmtUren(rapport.totaalUren)}
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  som over alle medewerkers
                </p>
              </div>
            </div>
          )}
          <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
            Manager-weergave: individuele uurlonen en bedragen per medewerker zijn alleen zichtbaar voor de owner.
          </p>
        </>
      )}

      {/* Owner-view: volledige tabel */}
      {rapport && rapport.rol === "owner" && rapport.perMedewerker.length === 0 && (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          Geen gewerkte uren in {MAANDEN[maand - 1]} {jaar}.
        </p>
      )}

      {rapport && rapport.rol === "owner" && rapport.perMedewerker.length > 0 && (
        <>
          {/* Tabel */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-[12px]" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 700 }}>
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th className="text-left p-2 font-medium">Medewerker</th>
                  <th className="text-right p-2 font-medium">Uren</th>
                  <th className="text-right p-2 font-medium">Uurloon</th>
                  <th className="text-right p-2 font-medium">Bruto</th>
                  <th className="text-right p-2 font-medium">Vak.geld</th>
                  <th className="text-right p-2 font-medium">Vak.uren</th>
                  <th className="text-right p-2 font-medium">Totaal</th>
                  <th className="text-center p-2 font-medium">Bron</th>
                  <th className="text-center p-2 font-medium">Status</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rapport.perMedewerker.map((r) => (
                  <tr
                    key={r.medewerkerId}
                    style={{
                      borderTop: "1px solid var(--hairline-2)",
                      opacity: r.dbStatus === "uitbetaald" ? 0.65 : 1,
                    }}
                  >
                    <td className="p-2" style={{ color: "var(--text)" }}>
                      {r.voornaam} <span style={{ color: "var(--muted)" }}>{r.achternaam}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmtUren(r.brutoUren)}</td>
                    <td className="p-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                      {fmtEur(r.uurloon)}
                    </td>
                    <td className="p-2 text-right tabular-nums">{fmtEur(r.brutoLoon)}</td>
                    <td className="p-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                      {fmtEur(r.vakantiegeldEur)}
                    </td>
                    <td className="p-2 text-right tabular-nums" style={{ color: "var(--muted)" }}>
                      {fmtEur(r.vakantieUrenEur)}
                    </td>
                    <td className="p-2 text-right tabular-nums font-semibold" style={{ color: "var(--text)" }}>
                      {fmtEur(r.totaalEur)}
                    </td>
                    <td className="p-2 text-center text-[10px]" style={{ color: "var(--muted)" }}>
                      {r.bron}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wide"
                        style={{
                          background: `${STATUS_KLEUR[r.dbStatus]}1A`,
                          color: STATUS_KLEUR[r.dbStatus],
                        }}
                      >
                        {STATUS_LABEL[r.dbStatus]}
                        {!r.hashKlopt && (r.dbStatus === "afgerekend" || r.dbStatus === "uitbetaald") && (
                          <span title="Bron-data is gewijzigd ná afrekenen" style={{ marginLeft: 4 }}>⚠</span>
                        )}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {r.dbStatus === "afgerekend" && (
                        <button
                          onClick={() => markeerUitbetaald(r.medewerkerId, `${r.voornaam} ${r.achternaam}`)}
                          disabled={busy}
                          className="text-[11px] underline disabled:opacity-50"
                          style={{ color: hex }}
                        >
                          Markeer uitbetaald
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Totaalregel */}
                <tr style={{ borderTop: "2px solid var(--hairline)" }}>
                  <td className="p-2 font-semibold" style={{ color: "var(--text)" }}>TOTAAL</td>
                  <td></td>
                  <td></td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmtEur(rapport.totaalBrutoLoon)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtEur(rapport.totaalVakantiegeld)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtEur(rapport.totaalVakantieUren)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold" style={{ color: hex }}>
                    {fmtEur(rapport.totaalEur)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Actie: alles afrekenen */}
          {rapport.perMedewerker.some((r) => r.dbStatus === "open") && (
            <div className="flex items-center justify-end gap-2 mt-4 pt-3 hairline">
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Bevriest de bedragen voor alle open posten. Daarna kun je per medewerker uitbetaling markeren.
              </p>
              <button
                onClick={rekenAlleAf}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: hex }}
              >
                {busy ? "Bezig…" : "Reken alles af"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}
