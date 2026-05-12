"use client";

import { useState } from "react";
import type { Dienst, Medewerker, ShiftTemplate } from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";
import Icon from "./Icon";

interface Props {
  bedrijf: Bedrijf;
  hex: string;
  medewerkers: Medewerker[];
  templates: ShiftTemplate[];
  mode: "nieuw" | "bewerken";
  dienst?: Dienst;
  startDatum?: string;
  startUserId?: string;
  onSluit: () => void;
  onKlaar: () => void;
}

export default function DienstModal({
  bedrijf, hex, medewerkers, templates,
  mode, dienst, startDatum, startUserId,
  onSluit, onKlaar,
}: Props) {
  const [userId,   setUserId]   = useState(dienst?.medewerker.id ?? startUserId ?? medewerkers[0]?.id ?? "");
  const [datum,    setDatum]    = useState(dienst?.datum ?? startDatum ?? "");
  const [start,    setStart]    = useState(dienst?.start ?? "09:30");
  const [eind,     setEind]     = useState(dienst?.eind  ?? "16:00");
  const [tplId,    setTplId]    = useState<string>("");
  const [notitie,  setNotitie]  = useState("");
  const [publish,  setPublish]  = useState(dienst?.gepubliceerd ?? false);
  const [busy,     setBusy]     = useState(false);
  const [fout,     setFout]     = useState<string | null>(null);

  function kiesTemplate(id: string) {
    setTplId(id);
    const t = templates.find((t) => t.id === id);
    if (t) {
      setStart(t.start);
      setEind(t.eind);
    }
  }

  async function opslaan() {
    setBusy(true);
    setFout(null);
    try {
      const body = {
        bedrijf,
        userId,
        datum,
        start,
        eind,
        shiftTemplateId: tplId || undefined,
        notitie: notitie || undefined,
        gepubliceerd: publish,
      };
      const url = mode === "nieuw" ? "/api/shiftbase/rosters" : `/api/shiftbase/rosters/${dienst!.id}`;
      const method = mode === "nieuw" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "opslaan mislukt");
      }
      onKlaar();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  async function verwijderen() {
    if (!dienst) return;
    if (!confirm("Deze dienst verwijderen?")) return;
    setBusy(true);
    setFout(null);
    try {
      const res = await fetch(`/api/shiftbase/rosters/${dienst.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "verwijderen mislukt");
      }
      onKlaar();
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
            <Icon name="calendar-clock" size={18} className="opacity-70" />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
              {mode === "nieuw" ? "Nieuwe dienst" : "Dienst bewerken"}
            </h2>
          </div>
          <button onClick={onSluit} className="text-[20px]" style={{ color: "var(--muted)" }}>
            ×
          </button>
        </div>

        <div className="space-y-3">
          <Veld label="Medewerker">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="inputveld"
            >
              {medewerkers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.voornaam} {m.achternaam}
                </option>
              ))}
            </select>
          </Veld>

          <Veld label="Datum">
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="inputveld"
            />
          </Veld>

          {templates.length > 0 && (
            <Veld label="Snel kiezen (shift-template)">
              <select
                value={tplId}
                onChange={(e) => kiesTemplate(e.target.value)}
                className="inputveld"
              >
                <option value="">— eigen tijd —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.langeNaam} · {t.start}–{t.eind}
                  </option>
                ))}
              </select>
            </Veld>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Veld label="Start">
              <input
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="inputveld"
              />
            </Veld>
            <Veld label="Eind">
              <input
                type="time"
                step={900}
                value={eind}
                onChange={(e) => setEind(e.target.value)}
                className="inputveld"
              />
            </Veld>
          </div>

          <Veld label="Notitie (optioneel)">
            <input
              type="text"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              className="inputveld"
              placeholder="bv. drukke dag, marathon, etc."
            />
          </Veld>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            <span className="text-[13px]" style={{ color: "var(--text)" }}>
              Direct publiceren
            </span>
          </label>

          {fout && (
            <p className="text-[12px]" style={{ color: "#E5484D" }}>
              {fout}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-5 pt-3 hairline">
          {mode === "bewerken" ? (
            <button
              onClick={verwijderen}
              disabled={busy}
              className="text-[13px] font-medium disabled:opacity-50"
              style={{ color: "#E5484D" }}
            >
              Verwijderen
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onSluit}
              className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium"
              style={{ color: "var(--text-2)" }}
            >
              Annuleer
            </button>
            <button
              onClick={opslaan}
              disabled={busy || !userId || !datum}
              className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: hex }}
            >
              {busy ? "Bezig…" : "Opslaan"}
            </button>
          </div>
        </div>

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
