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

  const [voornaam,        setVoornaam]        = useState("");
  const [achternaam,      setAchternaam]      = useState("");
  const [email,           setEmail]           = useState("");
  const [startdatum,      setStartdatum]      = useState("");
  const [uurloon,         setUurloon]         = useState("");
  const [vakantiegeldPct, setVakantiegeldPct] = useState("8.33");
  const [vakantieUrenPct, setVakantieUrenPct] = useState("8.00");
  const [busy,            setBusy]            = useState(false);
  const [fout,            setFout]            = useState<string | null>(null);

  function reset() {
    setVoornaam(""); setAchternaam(""); setEmail(""); setStartdatum("");
    setUurloon(""); setVakantiegeldPct("8.33"); setVakantieUrenPct("8.00");
    setFout(null); setEdit(null);
  }

  function startBewerken(m: Medewerker) {
    setEdit(m);
    setVoornaam(m.voornaam);
    setAchternaam(m.achternaam);
    setEmail(m.email);
    setStartdatum(m.startdatum ?? "");
    setUurloon(m.uurloon !== null && m.uurloon !== undefined ? String(m.uurloon) : "");
    setVakantiegeldPct(String(m.vakantiegeldPct ?? 8.33));
    setVakantieUrenPct(String(m.vakantieUrenPct ?? 8.00));
    setModus("bewerken");
  }

  async function opslaan() {
    setBusy(true);
    setFout(null);
    try {
      const uurloonNum = uurloon.trim() ? Number(uurloon.replace(",", ".")) : null;
      const vgPct = Number(vakantiegeldPct.replace(",", ".")) || 8.33;
      const vuPct = Number(vakantieUrenPct.replace(",", ".")) || 8.00;

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
        // Net aangemaakt: nog uurloon/% updaten met PUT
        if (uurloonNum !== null) {
          const j = await res.json();
          await fetch(`/api/shiftbase/medewerkers/${j.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uurloon: uurloonNum, vakantiegeldPct: vgPct, vakantieUrenPct: vuPct }),
          });
        }
      } else if (modus === "bewerken" && edit) {
        const res = await fetch(`/api/shiftbase/medewerkers/${edit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voornaam, achternaam, email,
            startdatum: startdatum || undefined,
            uurloon: uurloonNum,
            vakantiegeldPct: vgPct,
            vakantieUrenPct: vuPct,
          }),
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

  const [gegenereerdeCode, setGegenereerdeCode] = useState<{
    code: string; email: string; voornaam: string; verlooptOp: string;
  } | null>(null);

  async function maakCode(m: Medewerker) {
    if (!m.email || m.email.startsWith("geen-email-")) {
      setFout("Deze medewerker heeft geen geldig e-mailadres — vul dat eerst in via Bewerken");
      return;
    }
    setBusy(true);
    setFout(null);
    try {
      const res = await fetch(`/api/medewerkers/${m.id}/code`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "code aanmaken mislukt");
      }
      const j = await res.json();
      setGegenereerdeCode({
        code: j.code,
        email: j.email,
        voornaam: j.voornaam,
        verlooptOp: j.verlooptOp,
      });
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
                        onClick={() => maakCode(m)}
                        disabled={busy}
                        className="px-2 py-1 text-[12px] rounded-md disabled:opacity-50 font-medium"
                        style={{ color: hex }}
                        title="Maak een 6-cijferige registratiecode aan voor handmatige uitdeling"
                      >
                        {m.heeftPin ? "Nieuwe code" : "Code aanmaken"}
                      </button>
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

            <Veld label="Uurloon (€) — leeg = nog niet ingesteld">
              <input
                type="text"
                inputMode="decimal"
                value={uurloon}
                onChange={(e) => setUurloon(e.target.value)}
                className="inputveld"
                placeholder="bv. 14,50"
              />
            </Veld>

            <div className="grid grid-cols-2 gap-3">
              <Veld label="Vakantiegeld %">
                <input
                  type="text"
                  inputMode="decimal"
                  value={vakantiegeldPct}
                  onChange={(e) => setVakantiegeldPct(e.target.value)}
                  className="inputveld"
                />
              </Veld>
              <Veld label="Vakantie-uren %">
                <input
                  type="text"
                  inputMode="decimal"
                  value={vakantieUrenPct}
                  onChange={(e) => setVakantieUrenPct(e.target.value)}
                  className="inputveld"
                />
              </Veld>
            </div>

            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Vakantiegeld + vakantie-uren worden direct met het uurloon uitbetaald.
              Defaults: 8,33% / 8,00%.
            </p>

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

      {gegenereerdeCode && (
        <CodeDialog
          code={gegenereerdeCode}
          hex={hex}
          onSluit={() => setGegenereerdeCode(null)}
        />
      )}
    </div>
  );
}

function CodeDialog({
  code, hex, onSluit,
}: {
  code: { code: string; email: string; voornaam: string; verlooptOp: string };
  hex: string;
  onSluit: () => void;
}) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const verlooptDatum = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric", month: "long",
  }).format(new Date(code.verlooptOp));

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(code.code);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 1500);
    } catch {
      // stil
    }
  }

  const deelTekst = `Hoi ${code.voornaam}! Je kunt je aanmelden bij het Studio Goud rooster met:\n\n• Email: ${code.email}\n• Code: ${code.code}\n\nGa naar: ${typeof window !== "undefined" ? window.location.origin : ""}/welkom\n\nKies daar een eigen 4-cijferige PIN om voortaan in te loggen. Code geldig t/m ${verlooptDatum}.`;

  async function deelViaWhatsapp() {
    const url = `https://wa.me/?text=${encodeURIComponent(deelTekst)}`;
    window.open(url, "_blank");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onSluit}
    >
      <div
        className="card max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-elev)" }}
      >
        <div className="text-center pb-4">
          <p className="eyebrow mb-1">Registratiecode voor {code.voornaam}</p>
          <p
            className="text-[42px] font-semibold tabular-nums tracking-widest hologram"
            style={{ color: hex, letterSpacing: "0.15em" }}
          >
            {code.code}
          </p>
          <p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
            Geldig t/m {verlooptDatum}
          </p>
        </div>

        <div
          className="p-3 rounded-[10px] mb-3 text-[12.5px]"
          style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
        >
          <p className="font-medium mb-1" style={{ color: "var(--text)" }}>
            Geef door aan {code.voornaam}:
          </p>
          <ol className="space-y-0.5 list-decimal list-inside" style={{ color: "var(--text-2)" }}>
            <li>Open <strong>/welkom</strong> op telefoon</li>
            <li>Vul email <strong>{code.email}</strong> in</li>
            <li>Vul code <strong>{code.code}</strong> in</li>
            <li>Kies eigen 4-cijferige PIN</li>
          </ol>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={deelViaWhatsapp}
            className="w-full py-2.5 rounded-[10px] text-[14px] font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: "#25D366" }}
          >
            Delen via WhatsApp
          </button>
          <button
            onClick={kopieer}
            className="w-full py-2 rounded-[10px] text-[13px] font-medium"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--hairline)",
              color: "var(--text)",
            }}
          >
            {gekopieerd ? "✓ Gekopieerd" : "Kopieer code"}
          </button>
          <button
            onClick={onSluit}
            className="w-full py-2 text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            Sluit
          </button>
        </div>
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
