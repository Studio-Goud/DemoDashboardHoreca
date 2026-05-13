"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dienst, Medewerker, ShiftTemplate, Beschikbaarheid } from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";
import Icon from "./Icon";
import DienstModal from "./DienstModal";
import MedewerkerBeheer from "./MedewerkerBeheer";

interface DagContext {
  datum: string;
  weekdag: number;
  weer: {
    tempMax: number;
    tempMin: number;
    neerslag: number;
    emoji: string;
    categorie: string;
  } | null;
  prognose: {
    verwacht: number;
    druk: "laag" | "normaal" | "druk" | "zeer druk" | "gesloten";
  } | null;
  cruises: Array<{
    schip: string;
    passagiers: number;
    aankomst: string | null;
    vertrek: string | null;
  }>;
  totaalPassagiers: number;
  feestdag: string | null;
  vakantie: string | null;
}

interface Props {
  bedrijf: Bedrijf;
  naam: string;
  hex: string;
  weekStart: string;
  weekEind: string;
  initieleDiensten: Dienst[];
  medewerkers: Medewerker[];
  templates: ShiftTemplate[];
  beschikbaarheid: Beschikbaarheid[];
  dagContexten: DagContext[];
}

const DAG_LANG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

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
  return `${parseInt(d)}/${parseInt(m)}`;
}

function fmtLangDatum(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d)} ${MAAND_KORT[parseInt(m) - 1]}`;
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

const DRUKTE_KLEUR: Record<NonNullable<DagContext["prognose"]>["druk"], string> = {
  gesloten:   "#8E8E93",
  laag:       "#30B26F",
  normaal:    "#0A84FF",
  druk:       "#E07A1F",
  "zeer druk":"#E5484D",
};
const DRUKTE_LABEL: Record<NonNullable<DagContext["prognose"]>["druk"], string> = {
  gesloten:   "Gesloten",
  laag:       "Rustig",
  normaal:    "Normaal",
  druk:       "Druk",
  "zeer druk":"Extreem druk",
};

export default function RoosterEditor({
  bedrijf, naam, hex,
  weekStart, weekEind,
  initieleDiensten, medewerkers, templates,
  beschikbaarheid,
  dagContexten,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const [toonBeheer, setToonBeheer] = useState(false);
  const [openDag, setOpenDag] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | { mode: "nieuw"; datum: string; userId?: string }
    | { mode: "bewerken"; dienst: Dienst }
    | null
  >(null);

  const vandaag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
  const weekNr = getWeekNr(weekStart);

  // Beschikbaarheid lookup: key = `${userId}|${datum}`
  const beschikbaarMap = new Map<string, Beschikbaarheid>();
  for (const b of beschikbaarheid) {
    beschikbaarMap.set(`${b.userId}|${b.datum}`, b);
  }

  // Diensten per datum
  function dienstenOpDag(datum: string): Dienst[] {
    return initieleDiensten
      .filter((d) => d.datum === datum)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  function vorigeWeek() {
    router.push(`/${bedrijf}/rooster?week=${plusDagen(weekStart, -7)}`);
  }
  function volgendeWeek() {
    router.push(`/${bedrijf}/rooster?week=${plusDagen(weekStart, 7)}`);
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

  /**
   * Genereer een concept-rooster voor deze week. mode = "heuristiek"
   * gebruikt vaste templates + kosten/baten-sorting (gratis, snel).
   * mode = "ai" stuurt context naar Claude die ook historische patronen
   * en samenwerkings-voorkeuren meeweegt (kost API-credits, betere kwaliteit).
   */
  async function autoRooster(mode: "heuristiek" | "ai") {
    const naam = mode === "ai" ? "AI-rooster (Claude)" : "Snel-rooster (heuristiek)";
    const opmerking = mode === "ai"
      ? "Dit gebruikt Claude AI en kost API-credits. Bedoeld voor lege of nauwelijks-ingeplande weken."
      : "Snel concept-rooster op basis van vaste templates + kosten/baten-balans.";
    if (!confirm(`${naam} maken voor deze week?\n\n${opmerking}\n\nBestaande gepubliceerde diensten blijven onaangetast — alleen lege dagen worden ingevuld als concept.`)) return;

    setBusy(true);
    setFoutmelding(null);
    try {
      const res = await fetch(`/api/rooster/auto/${bedrijf}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, mode }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "auto-rooster mislukt");
      }
      const j = (await res.json()) as {
        mode: string;
        ingepland: Array<{ datum: string; medewerker: string }>;
        overgeslagen?: Array<{ datum?: string; reden?: string }>;
        samenvatting?: {
          aantalIngepland?: number;
          totaalUren?: number;
          totaalLoonkosten?: number;
          totaalVerwachteOmzet?: number;
          loonkostPctWeek?: number;
        };
        weekSamenvatting?: string;
        waarschuwingen?: string[];
      };

      startTransition(() => router.refresh());

      const aantal = j.samenvatting?.aantalIngepland ?? j.ingepland?.length ?? 0;
      const totUren = j.samenvatting?.totaalUren ?? 0;
      const totKost = j.samenvatting?.totaalLoonkosten ?? 0;
      const pct = j.samenvatting?.loonkostPctWeek ?? 0;
      const overgeslagen = j.overgeslagen?.length ?? 0;

      const regels = [
        `✓ ${aantal} concept-dienst(en) gemaakt voor deze week.`,
        `Uren: ${totUren.toFixed(1)}u · Loonkost: €${totKost.toFixed(0)}`,
      ];
      if (j.samenvatting?.totaalVerwachteOmzet) {
        regels.push(`Verwachte omzet: €${j.samenvatting.totaalVerwachteOmzet.toFixed(0)} (loonkost ${(pct * 100).toFixed(0)}% v.d. omzet)`);
      }
      if (overgeslagen > 0) {
        regels.push(`\n⚠ ${overgeslagen} shift(s) niet kunnen invullen — bekijk de details per dag.`);
      }
      if (j.weekSamenvatting) {
        regels.push(`\nAI: ${j.weekSamenvatting}`);
      }
      if (j.waarschuwingen && j.waarschuwingen.length > 0) {
        regels.push(`\n${j.waarschuwingen.join("\n")}`);
      }
      regels.push("\nDe diensten staan als CONCEPT in de week. Bekijk per dag, pas aan waar nodig, en klik daarna op 'Publiceer'.");

      alert(regels.join("\n"));
    } catch (e) {
      setFoutmelding(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  const conceptenDezeWeek = initieleDiensten.filter((d) => !d.gepubliceerd).length;
  const totaalUren = initieleDiensten.reduce((s, d) => s + d.uren, 0);

  // Open standaard de huidige dag (als die in de week valt) of anders niets
  if (openDag === null && dagContexten.some((d) => d.datum === vandaag)) {
    // Initial state: open vandaag — maar zonder useEffect doen we dit niet auto.
    // Laat openDag toch null; gebruiker klikt om te openen.
  }

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
            <p className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
              {initieleDiensten.length} diensten · {totaalUren.toFixed(1)}u totaal
              {conceptenDezeWeek > 0 && ` · ${conceptenDezeWeek} concept`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Auto-rooster knoppen — vullen concepten in voor de hele week */}
          <button
            onClick={() => autoRooster("heuristiek")}
            disabled={busy || pending}
            className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            title="Snel concept-rooster op basis van templates + uurloon-volgorde"
          >
            ⚡ Snel-rooster
          </button>

          <button
            onClick={() => autoRooster("ai")}
            disabled={busy || pending}
            className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-opacity disabled:opacity-50 text-white"
            style={{
              background: "linear-gradient(135deg, #BF5AF2 0%, #7B2DAA 100%)",
              boxShadow: "0 2px 10px -2px rgba(191,90,242,0.4)",
            }}
            title="Claude AI maakt het rooster — gebruikt historische patronen + verwachte drukte + uurloon"
          >
            ✨ AI-rooster
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

      {/* Dag-cards */}
      <div className="space-y-2">
        {dagContexten.map((dag) => {
          const isOpen = openDag === dag.datum;
          const isToday = dag.datum === vandaag;
          const diensten = dienstenOpDag(dag.datum);
          const dagUren = diensten.reduce((s, d) => s + d.uren, 0);
          const drukKleur = dag.prognose ? DRUKTE_KLEUR[dag.prognose.druk] : "var(--muted)";
          const drukLabel = dag.prognose ? DRUKTE_LABEL[dag.prognose.druk] : null;

          return (
            <div
              key={dag.datum}
              className="card p-0 overflow-hidden transition-all"
              style={{
                borderColor: isToday ? `${hex}55` : isOpen ? `${hex}33` : undefined,
              }}
            >
              {/* Header — klikbaar */}
              <button
                onClick={() => setOpenDag(isOpen ? null : dag.datum)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                style={{
                  background: isOpen ? `${hex}08` : "transparent",
                }}
              >
                {/* Chevron */}
                <span
                  className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  style={{ color: "var(--muted)" }}
                >
                  <Icon name="chevron-right" size={14} />
                </span>

                {/* Datum */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p
                      className="text-[15px] font-semibold tracking-tight"
                      style={{ color: isToday ? hex : "var(--text)", letterSpacing: "-0.014em" }}
                    >
                      {DAG_LANG[dag.weekdag]} {fmtLangDatum(dag.datum)}
                    </p>
                    {isToday && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${hex}1A`, color: hex }}
                      >
                        vandaag
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: "var(--muted)" }}>
                    {diensten.length === 0 ? (
                      <span style={{ color: "#E5484D" }}>geen diensten gepland</span>
                    ) : (
                      <>
                        {diensten.length} {diensten.length === 1 ? "dienst" : "diensten"} · {dagUren.toFixed(1)}u
                      </>
                    )}
                  </p>
                </div>

                {/* Highlights rechts */}
                <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                  {dag.weer && (
                    <span
                      className="inline-flex items-center gap-1 text-[12px] tabular-nums px-2 py-0.5 rounded-md"
                      style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text-2)" }}
                      title={dag.weer.categorie}
                    >
                      <span>{dag.weer.emoji}</span>
                      <span>{Math.round(dag.weer.tempMax)}°</span>
                    </span>
                  )}
                  {dag.prognose && drukLabel && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{
                        background: `${drukKleur}1A`,
                        color: drukKleur,
                      }}
                      title={`Verwacht €${dag.prognose.verwacht.toFixed(0)}`}
                    >
                      {drukLabel}
                    </span>
                  )}
                  {dag.totaalPassagiers > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md tabular-nums"
                      style={{
                        background: "rgba(94, 92, 230, 0.12)",
                        color: "#5E5CE6",
                      }}
                      title={`${dag.cruises.length} schip(en)`}
                    >
                      ⚓ {dag.totaalPassagiers.toLocaleString("nl-NL")}
                    </span>
                  )}
                  {(dag.feestdag || dag.vakantie) && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{
                        background: "rgba(255, 159, 10, 0.14)",
                        color: "#E07A1F",
                      }}
                      title={dag.feestdag || dag.vakantie || ""}
                    >
                      🎉 {dag.feestdag ? "Feestdag" : "Vakantie"}
                    </span>
                  )}
                </div>
              </button>

              {/* Expand-content */}
              {isOpen && (
                <div
                  className="border-t px-4 py-3 fade-up"
                  style={{ borderColor: "var(--hairline)", background: "var(--bg)" }}
                >
                  {/* Highlights detail */}
                  {(dag.cruises.length > 0 || dag.feestdag || dag.vakantie || dag.prognose) && (
                    <div className="space-y-1.5 mb-3">
                      {dag.prognose && (
                        <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                          📈 Verwachte omzet: <span className="tabular-nums font-medium">€{dag.prognose.verwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}</span>
                          {drukLabel && <span style={{ color: drukKleur }}> · {drukLabel}</span>}
                        </p>
                      )}
                      {dag.cruises.length > 0 && (
                        <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                          ⚓ Cruises:{" "}
                          {dag.cruises.map((c, i) => (
                            <span key={i} className="tabular-nums">
                              <span className="font-medium">{c.schip}</span>
                              {" "}({c.passagiers.toLocaleString("nl-NL")} pax
                              {c.aankomst && `, aank. ${c.aankomst}`}
                              {c.vertrek && `, vertr. ${c.vertrek}`}
                              )
                              {i < dag.cruises.length - 1 && " · "}
                            </span>
                          ))}
                        </p>
                      )}
                      {dag.feestdag && (
                        <p className="text-[12px]" style={{ color: "#E07A1F" }}>
                          🎉 {dag.feestdag}
                        </p>
                      )}
                      {dag.vakantie && (
                        <p className="text-[12px]" style={{ color: "#E07A1F" }}>
                          🏖 Schoolvakantie: {dag.vakantie}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Diensten lijst */}
                  {diensten.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {diensten.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setModal({ mode: "bewerken", dienst: d })}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] text-left transition-all"
                          style={{
                            background: d.gepubliceerd ? `${hex}10` : "var(--bg-elev)",
                            border: `1px ${d.gepubliceerd ? "solid" : "dashed"} ${d.gepubliceerd ? `${hex}44` : "var(--hairline)"}`,
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarMini voornaam={d.medewerker.voornaam} naam={d.medewerker.naam} avatar={d.medewerker.avatar} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
                                {d.medewerker.voornaam} <span style={{ color: "var(--muted)" }}>{d.medewerker.naam.split(" ").slice(-1)[0]}</span>
                              </p>
                              <p className="text-[11px] tabular-nums" style={{ color: hex }}>
                                {d.start} – {d.eind}
                                {d.shiftType && <span style={{ color: "var(--muted)" }}> · {d.shiftType}</span>}
                                {!d.gepubliceerd && <span style={{ color: "var(--muted)" }}> · concept</span>}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[12px] tabular-nums" style={{ color: "var(--text-2)" }}>
                              {d.uren.toFixed(1)}u
                            </span>
                            <Icon name="chevron-right" size={14} className="opacity-40" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Medewerkers nog niet ingepland — beschikbaarheid badge */}
                  <div className="space-y-2">
                    <p className="eyebrow">Medewerker toevoegen</p>
                    {medewerkers.length === 0 ? (
                      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                        Nog geen medewerkers in {naam}.{" "}
                        <button
                          onClick={() => setToonBeheer(true)}
                          className="underline"
                          style={{ color: hex }}
                        >
                          Toevoegen
                        </button>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {medewerkers.map((m) => {
                          const besch = beschikbaarMap.get(`${m.id}|${dag.datum}`);
                          const alIngepland = diensten.some((d) => d.medewerker.id === m.id);
                          const beschKleur =
                            besch?.status === "vrij"    ? "#30B26F"
                            : besch?.status === "beperkt" ? "#30B26F"
                            : besch?.status === "niet"    ? "#E5484D"
                            : null;
                          const beschTitle =
                            besch?.status === "vrij"    ? "Hele dag beschikbaar"
                            : besch?.status === "beperkt" ? `Beschikbaar ${besch.start ?? ""}–${besch.eind ?? ""}`
                            : besch?.status === "niet"    ? `Niet beschikbaar${besch.reden ? ` · ${besch.reden}` : ""}`
                            : "Geen beschikbaarheid opgegeven";

                          return (
                            <button
                              key={m.id}
                              onClick={() => setModal({ mode: "nieuw", datum: dag.datum, userId: m.id })}
                              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[12px] transition-all"
                              style={{
                                background: alIngepland ? "var(--bg-elev)" : "transparent",
                                border: `1px ${besch?.status === "niet" ? "solid" : "dashed"} ${beschKleur ?? "var(--hairline)"}`,
                                opacity: alIngepland ? 0.45 : 1,
                                color: "var(--text)",
                              }}
                              title={`${m.voornaam} ${m.achternaam} — ${beschTitle}${alIngepland ? " (al ingepland)" : ""}`}
                            >
                              {beschKleur && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: beschKleur, opacity: besch?.status === "beperkt" ? 0.55 : 1 }}
                                />
                              )}
                              <span>{m.voornaam}</span>
                              {besch?.status === "beperkt" && besch.start && besch.eind && (
                                <span className="tabular-nums text-[10px]" style={{ color: "var(--muted)" }}>
                                  {besch.start}–{besch.eind}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setModal({ mode: "nieuw", datum: dag.datum })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-medium transition-all"
                          style={{
                            background: hex,
                            color: "white",
                          }}
                        >
                          + Andere
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toelichting */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: `${hex}33`, border: `1px solid ${hex}66` }} />
          Gepubliceerd
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ border: `1px dashed var(--hairline)` }} />
          Concept
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#30B26F" }} />
          Beschikbaar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#E5484D" }} />
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

function AvatarMini({ voornaam, naam, avatar }: { voornaam: string; naam: string; avatar?: string }) {
  const isPlaceholder = !avatar || avatar.includes("user-picture_");
  const achternaam = naam.split(" ").slice(-1)[0] ?? "";
  const initialen = (voornaam?.[0] ?? "") + (achternaam?.[0] ?? "");

  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0"
      style={{ background: "var(--hairline)" }}
    >
      {!isPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={naam} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-2)" }}>
          {initialen}
        </span>
      )}
    </div>
  );
}
