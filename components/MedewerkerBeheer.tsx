"use client";

import { useState } from "react";
import type { Medewerker } from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";
import Icon from "./Icon";

interface Props {
  bedrijf: Bedrijf;
  hex: string;
  medewerkers: Medewerker[];
  onSluit: () => void;
  onWijziging: () => void;
}

type Modus = "lijst" | "nieuw" | "bewerken";

export default function MedewerkerBeheer({
  bedrijf, hex, medewerkers, onSluit, onWijziging,
}: Props) {
  const [modus, setModus] = useState<Modus>("lijst");
  const [edit, setEdit] = useState<Medewerker | null>(null);

  const [voornaam,   setVoornaam]   = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email,      setEmail]      = useState("");
  const [startdatum, setStartdatum] = useState("");
  const [busy,       setBusy]       = useState(false);
  const [fout,       setFout]       = useState<string | null>(null);

  function reset() {
    setVoornaam(""); setAchternaam(""); setEmail(""); setStartdatum("");
    setFout(null); setEdit(null);
  }

  function startBewerken(m: Medewerker) {
    setEdit(m);
    setVoornaam(m.voornaam);
    setAchternaam(m.achternaam);
    setEmail(m.email);
    setStartdatum(m.startdatum ?? "");
    setModus("bewerken");
  }

  async function opslaan() {
    setBusy(true);
    setFout(null);
    try {
      if (modus === "nieuw") {
        const res = await fetch("/api/shiftbase/medewerkers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bedrijf, voornaam, achternaam, email, startdatum: startdatum || undefined,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: "fout" }));
          throw new Error(j.error || "toevoegen mislukt");
        }
      } else if (modus === "bewerken" && edit) {
        const res = await fetch(`/api/shiftbase/medewerkers/${edit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voornaam, achternaam, email, startdatum: startdatum || undefined }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: "fout" }));
          throw new Error(j.error || "opslaan mislukt");
        }
      }
      reset();
      setModus("lijst");
      onWijziging();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  async function verwijderen(m: Medewerker) {
    if (!confirm(`${m.naam} verwijderen uit het rooster?\n\nLet op: in Shiftbase wordt de einddatum op vandaag gezet.`))
      return;
    setBusy(true);
    setFout(null);
    try {
      const res = await fetch(`/api/shiftbase/medewerkers/${m.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "verwijderen mislukt");
      }
      onWijziging();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onSluit}
    >
      <div
        className="card max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-elev)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="users" size={18} className="opacity-70" />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
              {modus === "lijst" ? "Medewerkers" : modus === "nieuw" ? "Nieuwe medewerker" : "Medewerker bewerken"}
            </h2>
          </div>
          <button onClick={onSluit} className="text-[20px]" style={{ color: "var(--muted)" }}>×</button>
        </div>

        {modus === "lijst" && (
          <>
            <div className="space-y-1.5 mb-4">
              {medewerkers.length === 0 ? (
                <p className="text-[13px] py-4 text-center" style={{ color: "var(--muted)" }}>
                  Nog geen medewerkers.
                </p>
              ) : (
                medewerkers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-[8px]"
                    style={{ background: "var(--bg)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>
                        {m.voornaam} {m.achternaam}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                        {m.email || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startBewerken(m)}
                        className="px-2 py-1 text-[12px] rounded-md"
                        style={{ color: hex }}
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => verwijderen(m)}
                        disabled={busy}
                        className="px-2 py-1 text-[12px] rounded-md disabled:opacity-50"
                        style={{ color: "#E5484D" }}
                      >
                        Verwijder
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => { reset(); setModus("nieuw"); }}
              className="w-full py-2 rounded-[8px] text-[13px] font-medium text-white"
              style={{ background: hex }}
            >
              + Nieuwe medewerker
            </button>
          </>
        )}

        {(modus === "nieuw" || modus === "bewerken") && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Veld label="Voornaam">
                <input
                  type="text"
                  value={voornaam}
                  onChange={(e) => setVoornaam(e.target.value)}
                  className="inputveld"
                />
              </Veld>
              <Veld label="Achternaam">
                <input
                  type="text"
                  value={achternaam}
                  onChange={(e) => setAchternaam(e.target.value)}
                  className="inputveld"
                />
              </Veld>
            </div>
            <Veld label="E-mailadres">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="inputveld"
              />
            </Veld>
            <Veld label="Startdatum">
              <input
                type="date"
                value={startdatum}
                onChange={(e) => setStartdatum(e.target.value)}
                className="inputveld"
              />
            </Veld>

            {fout && (
              <p className="text-[12px]" style={{ color: "#E5484D" }}>{fout}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 hairline">
              <button
                onClick={() => { reset(); setModus("lijst"); }}
                className="px-3 py-1.5 text-[13px]"
                style={{ color: "var(--text-2)" }}
              >
                Terug
              </button>
              <button
                onClick={opslaan}
                disabled={busy || !voornaam || !achternaam || !email}
                className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: hex }}
              >
                {busy ? "Bezig…" : "Opslaan"}
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          .inputveld {
            width: 100%;
            padding: 8px 10px;
            border-radius: 8px;
            background: var(--bg);
            border: 1px solid var(--hairline);
            color: var(--text);
            font-size: 13px;
            font-family: inherit;
          }
          .inputveld:focus {
            outline: none;
            border-color: ${hex};
          }
        `}</style>
      </div>
    </div>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow block mb-1">{label}</label>
      {children}
    </div>
  );
}
