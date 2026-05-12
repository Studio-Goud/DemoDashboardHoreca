"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dienst, Medewerker, ShiftTemplate, Beschikbaarheid } from "@/lib/shiftbase";
import type { Bedrijf } from "@/lib/sumup";
import Icon from "./Icon";
import DienstModal from "./DienstModal";
import MedewerkerBeheer from "./MedewerkerBeheer";
import RoosterDagSamenvatting from "./RoosterDagSamenvatting";

interface Props {
  bedrijf: Bedrijf;
  naam: string;
  hex: string;
  weekStart: string;     // YYYY-MM-DD (maandag)
  weekEind: string;      // YYYY-MM-DD (zondag)
  initieleDiensten: Dienst[];
  medewerkers: Medewerker[];
  templates: ShiftTemplate[];
  beschikbaarheid: Beschikbaarheid[];
}

const DAG_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAG_LANG = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

function plusDagen(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtKortDatum(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function getWeekNr(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  return 1 + Math.round(
    ((dt.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
}

export default function RoosterEditor({
  bedrijf, naam, hex,
  weekStart, weekEind,
  initieleDiensten, medewerkers, templates,
  beschikbaarheid,
}: Props) {
  // Lookup: key = `${userId}|${datum}` → eerste Beschikbaarheid entry
  const beschikbaarMap = new Map<string, Beschikbaarheid>();
  for (const b of beschikbaarheid) {
    beschikbaarMap.set(`${b.userId}|${b.datum}`, b);
  }
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const [toonBeheer, setToonBeheer] = useState(false);
  const [modal, setModal] = useState<
    | { mode: "nieuw"; datum: string; userId?: string }
    | { mode: "bewerken"; dienst: Dienst }
    | null
  >(null);

  const weekDatums = Array.from({ length: 7 }, (_, i) => plusDagen(weekStart, i));
  const weekNr = getWeekNr(weekStart);

  const vandaag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

  // Map per medewerker × datum → diensten
  function dienstenVoor(userId: string, datum: string): Dienst[] {
    return initieleDiensten
      .filter((d) => d.medewerker.id === userId && d.datum === datum)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  // Open uren per medewerker deze week
  function totaalUren(userId: string): number {
    return initieleDiensten
      .filter((d) => d.medewerker.id === userId)
      .reduce((s, d) => s + d.uren, 0);
  }

  function vorigeWeek() {
    const nieuw = plusDagen(weekStart, -7);
    router.push(`/${bedrijf}/rooster?week=${nieuw}`);
  }
  function volgendeWeek() {
    const nieuw = plusDagen(weekStart, 7);
    router.push(`/${bedrijf}/rooster?week=${nieuw}`);
  }
  function naarDezeWeek() {
    router.push(`/${bedrijf}/rooster`);
  }

  async function publiceer() {
    if (!confirm("Alle concepten in deze week publiceren?")) return;
    setBusy(true);
    setFoutmelding(null);
    try {
      const res = await fetch("/api/shiftbase/publiceer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedrijf, start: weekStart, eind: weekEind }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "publicatie mislukt");
      }
      const j = (await res.json()) as { gepubliceerd: number };
      startTransition(() => router.refresh());
      alert(`${j.gepubliceerd} dienst(en) gepubliceerd.`);
    } catch (e) {
      setFoutmelding(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  const conceptenDezeWeek = initieleDiensten.filter((d) => !d.gepubliceerd).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href={`/${bedrijf}`}
            className="text-[12px] flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={14} className="rotate-180" />
            Terug
          </a>
          <div className="min-w-0">
            <p className="eyebrow">Rooster · {naam}</p>
            <h1 className="text-[18px] font-semibold" style={{ color: "var(--text)" }}>
              Week {weekNr} · {fmtKortDatum(weekStart)} – {fmtKortDatum(weekEind)}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="segmented">
            <button onClick={vorigeWeek} className="segmented-item" aria-label="Vorige week">
              <Icon name="chevron-right" size={14} className="rotate-180" />
            </button>
            <button onClick={naarDezeWeek} className="segmented-item">
              Deze week
            </button>
            <button onClick={volgendeWeek} className="segmented-item" aria-label="Volgende week">
              <Icon name="chevron-right" size={14} />
            </button>
          </div>

          <button
            onClick={() => setToonBeheer(true)}
            className="segmented-item"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
          >
            <Icon name="users" size={14} />
            Medewerkers
          </button>

          {conceptenDezeWeek > 0 && (
            <button
              onClick={publiceer}
              disabled={busy || pending}
              className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-opacity disabled:opacity-50"
              style={{ background: hex, color: "white" }}
            >
              Publiceer ({conceptenDezeWeek})
            </button>
          )}
        </div>
      </div>

      {foutmelding && (
        <div className="card" style={{ borderColor: "#E5484D44" }}>
          <p className="text-[13px]" style={{ color: "#E5484D" }}>{foutmelding}</p>
        </div>
      )}

      {/* Dag-samenvatting: in één oogopslag wie er per dag staat */}
      <RoosterDagSamenvatting
        weekDatums={weekDatums}
        diensten={initieleDiensten}
        medewerkers={medewerkers}
        vandaag={vandaag}
        hex={hex}
        onKlikDag={(datum) => {
          // Scroll naar de kolom in de grid
          const el = document.querySelector(`[data-rooster-col="${datum}"]`);
          el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }}
      />

      {/* Grid */}
      <div className="card overflow-x-auto p-0">
        <table
          className="w-full text-[12px]"
          style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 900 }}
        >
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 text-left p-3"
                style={{
                  background: "var(--bg-elev)",
                  borderBottom: "1px solid var(--hairline)",
                  minWidth: 180,
                }}
              >
                <span className="eyebrow">Medewerker</span>
              </th>
              {weekDatums.map((datum, i) => {
                const isToday = datum === vandaag;
                return (
                  <th
                    key={datum}
                    data-rooster-col={datum}
                    className="p-3 text-center"
                    style={{
                      borderBottom: "1px solid var(--hairline)",
                      borderLeft: "1px solid var(--hairline-2)",
                      minWidth: 110,
                    }}
                  >
                    <p
                      className="text-[11px] uppercase tracking-wider"
                      style={{ color: isToday ? hex : "var(--muted)", fontWeight: isToday ? 700 : 500 }}
                    >
                      {DAG_KORT[i]}
                    </p>
                    <p
                      className="text-[14px] font-semibold tabular-nums"
                      style={{ color: isToday ? hex : "var(--text)" }}
                    >
                      {fmtKortDatum(datum)}
                    </p>
                  </th>
                );
              })}
              <th
                className="p-3 text-right"
                style={{
                  borderBottom: "1px solid var(--hairline)",
                  borderLeft: "1px solid var(--hairline-2)",
                  minWidth: 70,
                }}
              >
                <span className="eyebrow">Uren</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {medewerkers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center" style={{ color: "var(--muted)" }}>
                  Nog geen medewerkers toegevoegd aan {naam}.
                  <button
                    onClick={() => setToonBeheer(true)}
                    className="ml-2 underline"
                    style={{ color: hex }}
                  >
                    Toevoegen
                  </button>
                </td>
              </tr>
            ) : (
              medewerkers.map((m) => {
                const tot = totaalUren(m.id);
                return (
                  <tr key={m.id}>
                    <td
                      className="sticky left-0 z-10 p-3 align-top"
                      style={{
                        background: "var(--bg-elev)",
                        borderBottom: "1px solid var(--hairline-2)",
                        borderRight: "1px solid var(--hairline-2)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar medewerker={m} />
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ color: "var(--text)" }}>
                            {m.voornaam}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                            {m.achternaam}
                          </p>
                        </div>
                      </div>
                    </td>

                    {weekDatums.map((datum) => {
                      const cellen = dienstenVoor(m.id, datum);
                      const besch = beschikbaarMap.get(`${m.id}|${datum}`);
                      const celBg =
                        besch?.status === "vrij"     ? "rgba(48,178,111,0.10)"
                        : besch?.status === "beperkt" ? "rgba(48,178,111,0.06)"
                        : besch?.status === "niet"    ? "rgba(229,72,77,0.10)"
                        : "transparent";
                      const titel =
                        besch?.status === "vrij"    ? "Beschikbaar — hele dag"
                        : besch?.status === "beperkt" ? `Beschikbaar ${besch.start ?? ""}–${besch.eind ?? ""}${besch.reden ? ` · ${besch.reden}` : ""}`
                        : besch?.status === "niet"    ? `Niet beschikbaar${besch.reden ? ` · ${besch.reden}` : ""}`
                        : "Geen beschikbaarheid opgegeven";
                      return (
                        <td
                          key={datum}
                          className="p-1.5 align-top relative"
                          style={{
                            borderBottom: "1px solid var(--hairline-2)",
                            borderLeft: "1px solid var(--hairline-2)",
                            verticalAlign: "top",
                            background: celBg,
                          }}
                          title={titel}
                        >
                          {/* Indicator-stipje linksboven */}
                          {besch && (
                            <span
                              className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full pointer-events-none"
                              style={{
                                background:
                                  besch.status === "vrij" ? "#30B26F"
                                  : besch.status === "beperkt" ? "#30B26F"
                                  : "#E5484D",
                                opacity: besch.status === "beperkt" ? 0.55 : 1,
                              }}
                            />
                          )}
                          {/* Bij "beperkt": tijdsbereik subtiel rechtsboven */}
                          {besch?.status === "beperkt" && besch.start && besch.eind && (
                            <span
                              className="absolute top-1 right-1 text-[9px] tabular-nums px-1 rounded"
                              style={{ color: "#1F7A4E", background: "rgba(255,255,255,0.6)" }}
                            >
                              {besch.start}–{besch.eind}
                            </span>
                          )}
                          <div className="flex flex-col gap-1 mt-3">
                            {cellen.map((d) => (
                              <button
                                key={d.id}
                                onClick={() => setModal({ mode: "bewerken", dienst: d })}
                                className="text-left rounded-[6px] px-2 py-1.5 transition-all"
                                style={{
                                  background: d.gepubliceerd ? `${hex}1A` : "transparent",
                                  border: `1px ${d.gepubliceerd ? "solid" : "dashed"} ${hex}66`,
                                  color: "var(--text)",
                                }}
                                title={d.gepubliceerd ? "Gepubliceerd" : "Concept"}
                              >
                                <span
                                  className="block text-[11px] font-semibold tabular-nums"
                                  style={{ color: hex }}
                                >
                                  {d.start}–{d.eind}
                                </span>
                                <span
                                  className="block text-[10px]"
                                  style={{ color: "var(--muted)" }}
                                >
                                  {d.shiftType}
                                </span>
                              </button>
                            ))}
                            <button
                              onClick={() => setModal({ mode: "nieuw", datum, userId: m.id })}
                              className="rounded-[6px] py-1 text-[11px] transition-all opacity-40 hover:opacity-100"
                              style={{
                                border: "1px dashed var(--hairline)",
                                color: besch?.status === "niet" ? "#E5484D" : "var(--muted)",
                              }}
                            >
                              {besch?.status === "niet" ? "+ toch inplannen" : "+ voeg toe"}
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    <td
                      className="p-3 text-right tabular-nums"
                      style={{
                        borderBottom: "1px solid var(--hairline-2)",
                        borderLeft: "1px solid var(--hairline-2)",
                        color: "var(--text-2)",
                      }}
                    >
                      {tot.toFixed(1)}u
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Toelichting */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: `${hex}33`, border: `1px solid ${hex}66` }} />
          Gepubliceerd
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ border: `1px dashed ${hex}66` }} />
          Concept
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(48,178,111,0.18)" }} />
          Beschikbaar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(48,178,111,0.10)" }} />
          Beperkt beschikbaar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(229,72,77,0.18)" }} />
          Niet beschikbaar
        </span>
      </div>

      {/* Modals */}
      {modal && (
        <DienstModal
          bedrijf={bedrijf}
          hex={hex}
          medewerkers={medewerkers}
          templates={templates}
          mode={modal.mode}
          dienst={modal.mode === "bewerken" ? modal.dienst : undefined}
          startDatum={modal.mode === "nieuw" ? modal.datum : undefined}
          startUserId={modal.mode === "nieuw" ? modal.userId : undefined}
          onSluit={() => setModal(null)}
          onKlaar={() => {
            setModal(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {toonBeheer && (
        <MedewerkerBeheer
          bedrijf={bedrijf}
          hex={hex}
          medewerkers={medewerkers}
          onSluit={() => setToonBeheer(false)}
          onWijziging={() => startTransition(() => router.refresh())}
        />
      )}
    </div>
  );
}

function Avatar({ medewerker }: { medewerker: Medewerker }) {
  const isPlaceholder = !medewerker.avatar || medewerker.avatar.includes("user-picture_");
  const initialen =
    (medewerker.voornaam?.[0] ?? "") +
    (medewerker.achternaam?.[0] ?? "");

  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ background: "var(--hairline)" }}
    >
      {!isPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={medewerker.avatar} alt={medewerker.naam} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-2)" }}>
          {initialen}
        </span>
      )}
    </div>
  );
}
