"use client";

/**
 * Expliciete weergave van wie er beschikbaar is per dag in de huidige
 * week. Veel duidelijker dan de stippen-op-chip die anders in de
 * roostereditor staan — bedoeld voor managers die snel willen zien
 * "wie kan ik morgen inplannen en wanneer?".
 *
 * Standaard ingeklapt; tikken op de header opent. Per dag groepeert
 * 'm medewerkers naar status (✅ hele dag / 🕓 met tijden / ❌ niet /
 * stilte). Medewerkers die niets hebben doorgegeven worden onderaan
 * als grijs lijstje getoond zodat manager weet wie nog niet heeft
 * gereageerd.
 */
import { useState } from "react";
import type { Medewerker, Beschikbaarheid } from "@/lib/rooster";

interface Props {
  weekStart: string;          // YYYY-MM-DD (maandag)
  dagen: Array<{ datum: string; weekdag: number }>;
  medewerkers: Medewerker[];
  beschikbaarheid: Beschikbaarheid[];
  hex: string;
}

type DagMap = Map<string, Beschikbaarheid>;

const WEEKDAG_LANG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

export default function BeschikbaarheidOverzicht({
  dagen, medewerkers, beschikbaarheid, hex,
}: Props) {
  const [ingeklapt, setIngeklapt] = useState(true);

  // Index: dag → medewerker.id → Beschikbaarheid
  const perDag = new Map<string, DagMap>();
  for (const b of beschikbaarheid) {
    const datumMap = perDag.get(b.datum) ?? new Map<string, Beschikbaarheid>();
    datumMap.set(b.userId, b);
    perDag.set(b.datum, datumMap);
  }

  // Snel-stats voor in de header
  const totaalMedewerkers = medewerkers.length;
  const heeftAntwoord = new Set<string>();
  for (const b of beschikbaarheid) heeftAntwoord.add(b.userId);
  const aantalMetAntwoord = heeftAntwoord.size;

  // Komende dag-stats voor de eerste dag van de week
  const eersteDag = dagen[0]?.datum;
  const eersteMap = eersteDag ? perDag.get(eersteDag) : undefined;
  let beschikEerste = 0;
  if (eersteMap) {
    eersteMap.forEach((b) => {
      if (b.status === "vrij" || b.status === "beperkt") beschikEerste++;
    });
  }

  return (
    <section
      className="rounded-2xl p-4 mb-3"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
    >
      <button
        type="button"
        onClick={() => setIngeklapt((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            👥 Wie is beschikbaar deze week
          </h3>
          {ingeklapt && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
              {aantalMetAntwoord} van {totaalMedewerkers} hebben iets doorgegeven
              {eersteDag && ` · maandag ${beschikEerste} beschikbaar`}
            </p>
          )}
        </div>
        <span
          className="text-[18px] shrink-0 transition-transform"
          style={{ color: "var(--muted)", transform: ingeklapt ? "rotate(0deg)" : "rotate(90deg)" }}
        >
          ›
        </span>
      </button>

      {!ingeklapt && (
        <div className="mt-3 space-y-3">
          {aantalMetAntwoord === 0 && (
            <div
              className="rounded-xl p-3 text-[12px]"
              style={{ background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.35)", color: "var(--text-2)" }}
            >
              ⚠ Nog niemand heeft beschikbaarheid doorgegeven voor deze week.
              Probeer de "Beschikbaarheid sync" hierboven, of vraag personeel
              om in Shiftbase / de app aan te geven wanneer ze kunnen.
            </div>
          )}

          {dagen.map((d) => (
            <DagOverzicht
              key={d.datum}
              datum={d.datum}
              weekdag={d.weekdag}
              medewerkers={medewerkers}
              dagMap={perDag.get(d.datum)}
              hex={hex}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DagOverzicht({
  datum, weekdag, medewerkers, dagMap,
}: {
  datum: string;
  weekdag: number;
  medewerkers: Medewerker[];
  dagMap: DagMap | undefined;
  hex: string;
}) {
  const vrij: Medewerker[] = [];
  const beperkt: Array<{ m: Medewerker; b: Beschikbaarheid }> = [];
  const niet: Array<{ m: Medewerker; b: Beschikbaarheid }> = [];
  const stilte: Medewerker[] = [];

  for (const m of medewerkers) {
    const b = dagMap?.get(m.id);
    if (!b)                       stilte.push(m);
    else if (b.status === "vrij")    vrij.push(m);
    else if (b.status === "beperkt") beperkt.push({ m, b });
    else if (b.status === "niet")    niet.push({ m, b });
    else                              stilte.push(m);
  }

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
      <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--text)" }}>
        {WEEKDAG_LANG[weekdag]} {datum.split("-")[2]}/{datum.split("-")[1]}
      </p>

      {vrij.length === 0 && beperkt.length === 0 && niet.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Niemand heeft iets doorgegeven voor deze dag.
        </p>
      ) : (
        <div className="space-y-1.5">
          {vrij.length > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] w-5 shrink-0" title="Hele dag beschikbaar">✅</span>
              <p className="text-[12px]" style={{ color: "var(--text)" }}>
                <strong>{vrij.length} hele dag:</strong>{" "}
                <span style={{ color: "var(--text-2)" }}>
                  {vrij.map((m) => m.voornaam).join(", ")}
                </span>
              </p>
            </div>
          )}

          {beperkt.length > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] w-5 shrink-0" title="Deels beschikbaar">🕓</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium mb-0.5" style={{ color: "var(--text)" }}>
                  {beperkt.length} met tijden:
                </p>
                <ul className="space-y-0.5">
                  {beperkt.map(({ m, b }) => (
                    <li key={m.id} className="text-[12px]" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "var(--text)" }}>{m.voornaam} {m.achternaam}</span>{" "}
                      <span className="tabular-nums">
                        {b.start ?? "?"} – {b.eind ?? "?"}
                      </span>
                      {b.reden && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {" "}· {b.reden}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {niet.length > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] w-5 shrink-0" title="Niet beschikbaar">❌</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium mb-0.5" style={{ color: "var(--text)" }}>
                  {niet.length} niet beschikbaar:
                </p>
                <ul className="space-y-0.5">
                  {niet.map(({ m, b }) => (
                    <li key={m.id} className="text-[12px]" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "var(--text)" }}>{m.voornaam} {m.achternaam}</span>
                      {b.reden && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {" "}· {b.reden}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {stilte.length > 0 && (
        <details className="mt-2">
          <summary
            className="text-[10px] cursor-pointer select-none"
            style={{ color: "var(--muted)" }}
          >
            {stilte.length} medewerker{stilte.length === 1 ? "" : "s"} heeft niets doorgegeven
          </summary>
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            {stilte.map((m) => m.voornaam).join(", ")}
          </p>
        </details>
      )}
    </div>
  );
}
