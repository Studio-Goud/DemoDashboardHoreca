"use client";

/**
 * Proactieve waarschuwing voor aankomende feestdagen — verschijnt op
 * het dashboard zodra een feestdag binnen X dagen valt EN er
 * historische data is van dezelfde feestdag in eerdere jaren.
 *
 * Doel: owner krijgt op tijd context — "over 12 dagen 2e Paasdag,
 * vorige 2 jaar gemiddeld €X — overweeg extra rooster".
 *
 * Toont alleen iets als:
 *   - Een feestdag binnen `binnenDagen` dagen valt (default 14)
 *   - We voor diezelfde feestdag in vorig jaar OF voorvorig jaar
 *     historische omzet hebben
 *   - Impact = "hoog" of "dicht" (anders te veel ruis)
 */
import { useMemo } from "react";
import { format, addDays, startOfDay, subYears, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { feestdagenVoorJaar, zoekFeestdagInJaar } from "@/lib/feestdagen";

interface DagOmzet {
  datum: string;
  omzet: number;
}

interface Props {
  dagOmzet: DagOmzet[];
  hex: string;
  /** Hoe ver vooruit kijken. Default 14 dagen. */
  binnenDagen?: number;
}

function fmtEur(n: number): string {
  return "€" + Math.round(n).toLocaleString("nl-NL");
}

/**
 * Schat de YoY groei op basis van de laatste 90 dagen vs dezelfde 90
 * dagen één jaar terug. Returnt een factor (1.12 = +12%). null als er
 * te weinig data is — dan vallen we terug op vorigOmzet zonder groei.
 *
 * Clamp tussen 0.7 en 1.6 om absurde uitschieters te vermijden bij dunne
 * historische data (één gekke uitschieter kan anders een +200% projectie
 * geven).
 */
function schatYoYGroei(dagIndex: Map<string, DagOmzet>): number | null {
  const vandaag = startOfDay(new Date());
  let huidig = 0;
  let eenJaarTerug = 0;
  let dagenMetBeide = 0;
  // Loop 90 dagen terug, sla vandaag zelf over (incomplete dag).
  for (let i = 1; i <= 90; i++) {
    const d = subDays(vandaag, i);
    const dPrev = subYears(d, 1);
    const a = dagIndex.get(format(d, "yyyy-MM-dd"))?.omzet;
    const b = dagIndex.get(format(dPrev, "yyyy-MM-dd"))?.omzet;
    if (a !== undefined && b !== undefined && b > 0) {
      huidig += a;
      eenJaarTerug += b;
      dagenMetBeide++;
    }
  }
  if (dagenMetBeide < 30 || eenJaarTerug === 0) return null;
  const factor = huidig / eenJaarTerug;
  return Math.max(0.7, Math.min(1.6, factor));
}

export default function KomendeFeestdagAlert({ dagOmzet, hex, binnenDagen = 14 }: Props) {
  const dagIndex = useMemo(() => new Map(dagOmzet.map((d) => [d.datum, d])), [dagOmzet]);
  const alert = useMemo(() => {
    const nu = startOfDay(new Date());
    const grens = addDays(nu, binnenDagen);

    // Verzamel alle feestdagen in huidig + volgend jaar binnen het venster
    const kandidaten = [];
    for (const jaar of [nu.getFullYear(), nu.getFullYear() + 1]) {
      for (const f of feestdagenVoorJaar(jaar)) {
        if (f.datum >= nu && f.datum <= grens && (f.impact === "hoog" || f.impact === "dicht")) {
          kandidaten.push(f);
        }
      }
    }
    if (kandidaten.length === 0) return null;

    // Pak de eerstkomende
    kandidaten.sort((a, b) => a.datum.getTime() - b.datum.getTime());
    const f = kandidaten[0];

    // Historische omzet vorig + voorvorig jaar
    const vorigJaar = zoekFeestdagInJaar(f.naam, f.datum.getFullYear() - 1);
    const voorvorigJaar = zoekFeestdagInJaar(f.naam, f.datum.getFullYear() - 2);
    const vorigOmzet = vorigJaar ? dagIndex.get(format(vorigJaar.datum, "yyyy-MM-dd"))?.omzet ?? null : null;
    const voorvorigOmzet = voorvorigJaar ? dagIndex.get(format(voorvorigJaar.datum, "yyyy-MM-dd"))?.omzet ?? null : null;

    if (vorigOmzet === null && voorvorigOmzet === null) return null;

    // Verwacht = meest recente referentie × YoY-groei (geen simpel
    // gemiddelde — we doen het elk jaar beter). Als groei niet meetbaar
    // is (te weinig data): geen aanpassing, gewoon vorigOmzet als basis.
    const groei = schatYoYGroei(dagIndex);
    let verwacht: number;
    let basisJaar: 1 | 2;
    if (vorigOmzet !== null) {
      verwacht = vorigOmzet * (groei ?? 1);
      basisJaar = 1;
    } else {
      // Alleen voorvorig jaar beschikbaar → 2× groei toepassen
      verwacht = (voorvorigOmzet as number) * Math.pow(groei ?? 1, 2);
      basisJaar = 2;
    }
    const dagenVanNu = Math.ceil((f.datum.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));

    return {
      naam: f.naam,
      datum: f.datum,
      impact: f.impact,
      dagenVanNu,
      verwacht,
      groei,
      basisJaar,
      vorigOmzet,
      voorvorigOmzet,
      vorigJaar: vorigJaar?.datum ?? null,
      voorvorigJaar: voorvorigJaar?.datum ?? null,
    };
  }, [dagIndex, binnenDagen]);

  if (!alert) return null;

  const groeiLabel =
    alert.groei !== null
      ? `${alert.groei >= 1 ? "+" : ""}${Math.round((alert.groei - 1) * 100)}% t.o.v. ${alert.basisJaar === 1 ? "vorig jr" : "2 jr terug"}`
      : `${alert.basisJaar === 1 ? "vorig jaar" : "2 jaar terug"} als basis`;

  return (
    <div
      className="card relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${hex}10 0%, transparent 60%)`,
        border: `1px solid ${hex}40`,
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <p
            className="font-mono text-[10px] tracking-[0.18em] uppercase mb-1"
            style={{ color: hex }}
          >
            🔔 Aankomende feestdag · {alert.dagenVanNu === 0 ? "VANDAAG" : alert.dagenVanNu === 1 ? "MORGEN" : `over ${alert.dagenVanNu} dagen`}
          </p>
          <h3
            className="font-display text-[16px] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {alert.naam}{" "}
            <span className="font-mono text-[12px] font-normal" style={{ color: "var(--muted)" }}>
              · {format(alert.datum, "EEEE d MMM", { locale: nl })}
            </span>
          </h3>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: alert.impact === "dicht" ? "rgba(255,61,92,0.15)" : "rgba(0,229,255,0.15)",
            color: alert.impact === "dicht" ? "var(--sf-danger)" : "var(--sf-accent)",
          }}
        >
          {alert.impact === "dicht" ? "DICHT" : "HOOG"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            Verwacht
          </p>
          <p
            className="font-display text-[20px] font-semibold tabular-nums leading-tight"
            style={{ color: hex, letterSpacing: "-0.018em" }}
          >
            {fmtEur(alert.verwacht)}
          </p>
          <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
            {groeiLabel}
          </p>
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            1 jaar terug
          </p>
          <p
            className="font-display text-[16px] font-semibold tabular-nums leading-tight"
            style={{ color: alert.vorigOmzet !== null ? "var(--text)" : "var(--muted)" }}
          >
            {alert.vorigOmzet !== null ? fmtEur(alert.vorigOmzet) : "—"}
          </p>
          <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
            {alert.vorigJaar ? format(alert.vorigJaar, "d MMM ’yy", { locale: nl }) : ""}
          </p>
        </div>
        <div>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            2 jaar terug
          </p>
          <p
            className="font-display text-[16px] font-semibold tabular-nums leading-tight"
            style={{ color: alert.voorvorigOmzet !== null ? "var(--text)" : "var(--muted)" }}
          >
            {alert.voorvorigOmzet !== null ? fmtEur(alert.voorvorigOmzet) : "—"}
          </p>
          <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
            {alert.voorvorigJaar ? format(alert.voorvorigJaar, "d MMM ’yy", { locale: nl }) : ""}
          </p>
        </div>
      </div>

      <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
        Tip: check je rooster voor {format(alert.datum, "d MMM", { locale: nl })} —
        {alert.impact === "dicht"
          ? " sluit op tijd, geen open-uren plannen."
          : " plan extra capaciteit voor de drukte."}
      </p>
    </div>
  );
}
