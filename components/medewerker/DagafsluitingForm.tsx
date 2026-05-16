"use client";

/**
 * Dagafsluitingsformulier voor medewerker. Stap-voor-stap:
 *   1. Kas tellen per denominatie → systeem berekent som
 *   2. Fooi apart
 *   3. Live verschil-banner vs verwachte cash uit POS
 *   4. Temperaturen per locatie (per vestiging config)
 *   5. Schoonmaak-checks
 *   6. Notitie + Envelop in kluis-toggle
 *
 * Stuur GEEN handmatige berekeningen mee — alles wordt server-side opnieuw
 * gevalideerd via lib/dagafsluiting.ts.
 */
import { useEffect, useMemo, useState } from "react";

interface Denominatie { sleutel: string; label: string; waardeCent: number }
interface TempLocatie { id: string; label: string; emoji: string; max?: number }
interface SchoonmaakItem { id: string; label: string }

interface Voorbereiding {
  dept: string;
  datum: string;
  denominaties: Denominatie[];
  config: {
    startkassaDoel: number;
    temperatuurLocaties: TempLocatie[];
    schoonmaakChecks: SchoonmaakItem[];
  };
  verwachtContant: number;
  posOmzetTotaal: number;
  bestaand: {
    contantGeteld: number;
    fooi: number;
    enveloppe: number;
    kasVerschil: number | null;
    verschilToelichting: string | null;
    muntenTelling: Record<string, number>;
    temperaturen: Array<{ locatie: string; waardeC: number; opmerking?: string }>;
    schoonmaakChecks: Array<{ label: string; gedaan: boolean; opmerking?: string }>;
    enveloppeInKluis: boolean;
    alleSchoonmaakVoltooid: boolean;
    notitie: string | null;
    gecontroleerdDoor: string | null;
    ingediendOp: string;
  } | null;
  vorigeDag: {
    datum: string;
    contantGeteld: number;
    enveloppe: number;
  } | null;
}

const DREMPEL_TOELICHTING = 2;

export default function DagafsluitingForm() {
  const [data, setData] = useState<Voorbereiding | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [succes, setSucces] = useState<string | null>(null);

  // State
  const [munten, setMunten] = useState<Record<string, number>>({});
  const [fooi, setFooi] = useState<number>(0);
  const [verschilToelichting, setVerschilToelichting] = useState("");
  const [temperaturen, setTemperaturen] = useState<Record<string, { waarde: string; opmerking: string }>>({});
  const [checks, setChecks] = useState<Record<string, { gedaan: boolean; opmerking: string }>>({});
  const [alleSchoonmaak, setAlleSchoonmaak] = useState(false);
  const [enveloppeInKluis, setEnveloppeInKluis] = useState(false);
  const [notitie, setNotitie] = useState("");

  useEffect(() => {
    fetch("/api/medewerker/dagafsluiting", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const d = await res.json() as Voorbereiding;
        setData(d);
        // Voor-vullen met bestaande data
        if (d.bestaand) {
          setMunten(d.bestaand.muntenTelling ?? {});
          setFooi(d.bestaand.fooi);
          setVerschilToelichting(d.bestaand.verschilToelichting ?? "");
          setNotitie(d.bestaand.notitie ?? "");
          setEnveloppeInKluis(d.bestaand.enveloppeInKluis);
          setAlleSchoonmaak(d.bestaand.alleSchoonmaakVoltooid);
          const t: typeof temperaturen = {};
          for (const x of d.bestaand.temperaturen ?? []) {
            t[x.locatie] = { waarde: String(x.waardeC), opmerking: x.opmerking ?? "" };
          }
          setTemperaturen(t);
          const c: typeof checks = {};
          for (const x of d.bestaand.schoonmaakChecks ?? []) {
            c[x.label] = { gedaan: x.gedaan, opmerking: x.opmerking ?? "" };
          }
          setChecks(c);
        }
      })
      .catch((e) => setFout(e instanceof Error ? e.message : "fout"));
  }, []);

  // ─── Live berekeningen (client-side; server valideert nogmaals) ──────────
  const contantGeteld = useMemo(() => {
    if (!data) return 0;
    let c = 0;
    for (const d of data.denominaties) c += (munten[d.sleutel] ?? 0) * d.waardeCent;
    return c / 100;
  }, [munten, data]);

  const startkassa = data?.config.startkassaDoel ?? 100;
  const enveloppe = useMemo(
    () => Math.round((contantGeteld - startkassa - fooi) * 100) / 100,
    [contantGeteld, startkassa, fooi],
  );
  const verwachtContant = data?.verwachtContant ?? 0;
  const kasVerschil = useMemo(
    () => Math.round((enveloppe - verwachtContant) * 100) / 100,
    [enveloppe, verwachtContant],
  );
  const toelichtingVereist = Math.abs(kasVerschil) > DREMPEL_TOELICHTING && verwachtContant > 5;

  const startkassaAfwijking = useMemo(() => {
    if (!data?.vorigeDag) return null;
    // De verwachting is dat startkassa = startkassa-doel (€100), niet de
    // contant-telling van gisteren. Maar als gisteren rapporteerde "153
    // startkassa", dan zou de lade vanochtend 153 moeten zijn. Dit is een
    // signaal dat hand-overs niet goed gaan.
    return Math.round((contantGeteld - data.vorigeDag.contantGeteld + fooi + enveloppe) * 100) / 100;
  }, [data, contantGeteld, fooi, enveloppe]);

  // ─── Validatie ───────────────────────────────────────────────────────────
  const heeftMunten = Object.values(munten).some((v) => v > 0);
  const alleTempIngevuld = data
    ? data.config.temperatuurLocaties.every((l) => temperaturen[l.id]?.waarde.trim())
    : false;
  const kanInsturen =
    heeftMunten &&
    alleTempIngevuld &&
    (!toelichtingVereist || verschilToelichting.trim().length > 0);

  // ─── Submit ──────────────────────────────────────────────────────────────
  async function instuur() {
    if (!data) return;
    setBezig(true);
    setFout(null);
    try {
      const body = {
        dept: data.dept,
        datum: data.datum,
        startkassaDoel: startkassa,
        munten,
        fooi,
        temperaturen: data.config.temperatuurLocaties.flatMap((l) => {
          const v = temperaturen[l.id];
          if (!v?.waarde) return [];
          return [{
            locatie: l.label,
            waardeC: parseFloat(v.waarde.replace(",", ".")),
            opmerking: v.opmerking || undefined,
          }];
        }),
        schoonmaakChecks: data.config.schoonmaakChecks.map((c) => ({
          label: c.label,
          gedaan: checks[c.label]?.gedaan ?? false,
          opmerking: checks[c.label]?.opmerking || undefined,
        })),
        alleSchoonmaakVoltooid: alleSchoonmaak,
        enveloppeInKluis,
        notitie: notitie || undefined,
        verschilToelichting: toelichtingVereist ? verschilToelichting : undefined,
      };
      const res = await fetch("/api/medewerker/dagafsluiting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.fout || json.error || "fout");
      setSucces("✓ Dagafsluiting verstuurd. Manager kijkt 'm na.");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  if (fout && !data) {
    return <p className="text-[13px] p-4" style={{ color: "#E5484D" }}>Fout: {fout}</p>;
  }
  if (!data) {
    return <p className="text-[13px] p-4" style={{ color: "var(--muted)" }}>Laden…</p>;
  }

  const gecontroleerd = data.bestaand?.gecontroleerdDoor !== null && data.bestaand?.gecontroleerdDoor !== undefined;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          🧹 Schoonmaak &amp; Kasrapport
        </h1>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          {nlDatumLang(data.datum)} · vestiging {data.dept.toUpperCase()}
        </p>
        {gecontroleerd && (
          <p className="text-[11px] mt-1" style={{ color: "#30B26F" }}>
            ✓ Al gecontroleerd door {data.bestaand?.gecontroleerdDoor}
          </p>
        )}
      </header>

      {/* ─── KAS TELLEN ────────────────────────────────────────────────── */}
      <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text)" }}>
          💰 Kas tellen
        </h2>
        <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
          Tik per soort het aantal in dat in de lade ligt. Het systeem rekent het uit — geen fout meer mogelijk.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {data.denominaties.map((d) => (
            <label
              key={d.sleutel}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-text"
              style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
            >
              <span
                className="text-[12px] tabular-nums shrink-0"
                style={{ color: "var(--text-2)", minWidth: 34 }}
              >
                {d.label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={munten[d.sleutel] ?? ""}
                onChange={(e) => setMunten((m) => ({
                  ...m,
                  [d.sleutel]: Math.max(0, parseInt(e.target.value) || 0),
                }))}
                disabled={gecontroleerd}
                className="flex-1 min-w-0 bg-transparent border-0 p-0 text-[15px] tabular-nums text-right outline-none disabled:opacity-50"
                style={{ color: "var(--text)" }}
                placeholder="0"
              />
            </label>
          ))}
        </div>

        <div className="rounded-xl p-3 mb-3" style={{ background: "var(--bg)" }}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[12px]" style={{ color: "var(--text-2)" }}>Contant in lade</span>
            <span className="text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {fmtEur(contantGeteld)}
            </span>
          </div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>− Startkassa-doel</span>
            <span className="text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>
              −{fmtEur(startkassa)}
            </span>
          </div>
          <div className="flex items-baseline gap-2 justify-between mb-1">
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>− Fooi</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.50"
              min="0"
              value={fooi || ""}
              onChange={(e) => setFooi(Math.max(0, parseFloat(e.target.value) || 0))}
              disabled={gecontroleerd}
              className="w-20 px-2 py-1 rounded-md text-[12px] tabular-nums text-right disabled:opacity-50"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
              placeholder="0"
            />
          </div>
          <hr className="my-2" style={{ borderColor: "var(--hairline)" }} />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
              → Naar envelop
            </span>
            <span className="text-[20px] font-semibold tabular-nums" style={{ color: heeftMunten ? "#0A84FF" : "var(--muted)" }}>
              {heeftMunten ? fmtEur(enveloppe) : "—"}
            </span>
          </div>
        </div>

        {/* Verschil-banner — pas tonen als er getelt is */}
        {heeftMunten && (
          <div
            className="rounded-xl p-3"
            style={{
              background: Math.abs(kasVerschil) > DREMPEL_TOELICHTING ? "#E5484D15" : "#30B26F15",
              border: `1px solid ${Math.abs(kasVerschil) > DREMPEL_TOELICHTING ? "#E5484D55" : "#30B26F55"}`,
            }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>Verwacht volgens kassa</span>
              <span className="text-[12px] tabular-nums" style={{ color: "var(--text-2)" }}>
                {fmtEur(verwachtContant)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                Verschil
              </span>
              <span
                className="text-[16px] font-semibold tabular-nums"
                style={{ color: Math.abs(kasVerschil) > DREMPEL_TOELICHTING ? "#E5484D" : "#30B26F" }}
              >
                {kasVerschil >= 0 ? "+" : "−"}{fmtEur(Math.abs(kasVerschil))}
              </span>
            </div>
            {verwachtContant === 0 && (
              <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
                (Geen contante POS-transacties geregistreerd vandaag — verschil-check overgeslagen)
              </p>
            )}
          </div>
        )}

        {toelichtingVereist && (
          <div className="mt-3">
            <label className="text-[11px] block mb-1" style={{ color: "#E5484D" }}>
              ⚠ Verschil &gt; €{DREMPEL_TOELICHTING} — toelichting verplicht
            </label>
            <textarea
              value={verschilToelichting}
              onChange={(e) => setVerschilToelichting(e.target.value)}
              disabled={gecontroleerd}
              placeholder="Bv. 'wisselgeld bij start klopte niet' / 'klant betaalde te veel terug' / etc"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-[13px] resize-none disabled:opacity-50"
              style={{ background: "var(--bg)", border: "1px solid #E5484D55", color: "var(--text)" }}
            />
          </div>
        )}

        {/* Startkassa-handover-check */}
        {data.vorigeDag && startkassaAfwijking !== null && Math.abs(startkassaAfwijking) > 2 && (
          <div className="mt-3 rounded-xl p-3 text-[11px]" style={{ background: "#E0A82E15", border: "1px solid #E0A82E55" }}>
            <p style={{ color: "var(--text-2)" }}>
              💡 Gisteren rapporteerden ze €{data.vorigeDag.contantGeteld.toFixed(2)} in lade. Vandaag begin je met
              €{(contantGeteld + fooi + enveloppe).toFixed(2)}. <strong>Verschil €{startkassaAfwijking.toFixed(2)}</strong> —
              check of er iets uit de lade is gehaald sinds gisteravond.
            </p>
          </div>
        )}
      </section>

      {/* ─── TEMPERATUREN ──────────────────────────────────────────────── */}
      <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text)" }}>
          🌡️ Temperaturen (HACCP)
        </h2>
        <div className="space-y-2">
          {data.config.temperatuurLocaties.map((l) => {
            const v = temperaturen[l.id] ?? { waarde: "", opmerking: "" };
            const waarde = parseFloat(v.waarde.replace(",", "."));
            const overschreden = !isNaN(waarde) && l.max !== undefined && waarde > l.max;
            return (
              <div key={l.id} className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[18px]">{l.emoji}</span>
                  <span className="text-[13px] flex-1" style={{ color: "var(--text)" }}>
                    {l.label}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={v.waarde}
                    onChange={(e) => setTemperaturen((t) => ({
                      ...t,
                      [l.id]: { ...v, waarde: e.target.value },
                    }))}
                    disabled={gecontroleerd}
                    placeholder={l.max !== undefined ? `≤ ${l.max}°C` : "°C"}
                    className="w-20 px-2 py-1.5 rounded-lg text-[14px] tabular-nums text-right disabled:opacity-50"
                    style={{
                      background: "var(--bg-elev)",
                      border: `1px solid ${overschreden ? "#E5484D" : "var(--hairline)"}`,
                      color: overschreden ? "#E5484D" : "var(--text)",
                    }}
                  />
                  <span className="text-[11px] w-6" style={{ color: "var(--muted)" }}>°C</span>
                </div>
                {overschreden && (
                  <p className="text-[10px]" style={{ color: "#E5484D" }}>
                    ⚠ Boven de max van {l.max}°C — check de werking van de koeling.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── SCHOONMAAK ────────────────────────────────────────────────── */}
      <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text)" }}>
          🧹 Schoonmaak-checks
        </h2>
        <div className="space-y-1.5 mb-3">
          {data.config.schoonmaakChecks.map((c) => {
            const v = checks[c.label] ?? { gedaan: false, opmerking: "" };
            return (
              <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={v.gedaan}
                  onChange={(e) => setChecks((cc) => ({
                    ...cc,
                    [c.label]: { ...v, gedaan: e.target.checked },
                  }))}
                  disabled={gecontroleerd}
                  className="w-4 h-4"
                />
                <span className="text-[13px] flex-1" style={{ color: "var(--text)" }}>{c.label}</span>
              </label>
            );
          })}
        </div>
        <label className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer" style={{ background: "var(--bg)" }}>
          <input
            type="checkbox"
            checked={alleSchoonmaak}
            onChange={(e) => setAlleSchoonmaak(e.target.checked)}
            disabled={gecontroleerd}
            className="w-4 h-4"
          />
          <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
            ✅ Alle schoonmaakpunten voltooid
          </span>
        </label>
      </section>

      {/* ─── ENVELOP + NOTITIE ─────────────────────────────────────────── */}
      <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <label className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-3" style={{ background: "var(--bg)" }}>
          <input
            type="checkbox"
            checked={enveloppeInKluis}
            onChange={(e) => setEnveloppeInKluis(e.target.checked)}
            disabled={gecontroleerd}
            className="w-4 h-4"
          />
          <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
            🔒 Envelop in kluis gelegd
          </span>
        </label>

        <label className="text-[11px] block mb-1" style={{ color: "var(--muted)" }}>
          Opmerking (optioneel)
        </label>
        <textarea
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
          disabled={gecontroleerd}
          placeholder="Bijzonderheden, defecte apparatuur, klantenklachten…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-[13px] resize-none disabled:opacity-50"
          style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text)" }}
        />
      </section>

      {/* ─── SUBMIT ────────────────────────────────────────────────────── */}
      {fout && (
        <p className="text-[12px] px-2" style={{ color: "#E5484D" }}>{fout}</p>
      )}
      {succes && (
        <p className="text-[13px] px-2" style={{ color: "#30B26F" }}>{succes}</p>
      )}

      {!gecontroleerd && (
        <button
          onClick={instuur}
          disabled={!kanInsturen || bezig}
          className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50"
          style={{ background: "#0A84FF" }}
        >
          {bezig ? "Versturen…" : data.bestaand ? "Bijwerken" : "Versturen"}
        </button>
      )}
      {!kanInsturen && !gecontroleerd && (
        <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
          {!heeftMunten && "Vul de kas-telling in. "}
          {!alleTempIngevuld && "Vul alle temperaturen in. "}
          {toelichtingVereist && verschilToelichting.trim().length === 0 && "Geef een toelichting bij het kasverschil. "}
        </p>
      )}
    </div>
  );
}

function fmtEur(v: number): string {
  const abs = Math.abs(v).toFixed(2).replace(".", ",");
  return v < 0 ? `−€${abs}` : `€${abs}`;
}

function nlDatumLang(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
