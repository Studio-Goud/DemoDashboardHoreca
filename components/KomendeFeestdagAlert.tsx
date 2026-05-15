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
import { useMemo, useState } from "react";
import { format, addDays, startOfDay, subYears, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { feestdagenVoorJaar, zoekFeestdagInJaar, feestdagOpDatum } from "@/lib/feestdagen";
import DetailSheet from "./sf/DetailSheet";
import { ChevronRight } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const dagIndex = useMemo(() => new Map(dagOmzet.map((d) => [d.datum, d])), [dagOmzet]);

  const forecast14 = useMemo(() => {
    const nu = startOfDay(new Date());
    const groei = schatYoYGroei(dagIndex);
    const rows: Array<{
      datum: Date;
      vorigOmzet: number | null;
      verwacht: number | null;
      feestdag: string | null;
      feestdagImpact: "hoog" | "middel" | "laag" | "dicht" | null;
    }> = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(nu, i);
      const vorigZelfde = subYears(d, 1);
      const vorig = dagIndex.get(format(vorigZelfde, "yyyy-MM-dd"))?.omzet ?? null;
      const f = feestdagOpDatum(d);
      // Als 't een feestdag is en wij hebben dezelfde feestdag in vorig
      // jaar staan → die referentie is preciezer dan "zelfde datum vorig
      // jaar" (1e Pinksterdag verschuift bv. tussen 19 mei en 9 juni).
      let basis = vorig;
      if (f) {
        const v = zoekFeestdagInJaar(f.naam, d.getFullYear() - 1);
        if (v) {
          const fdOmzet = dagIndex.get(format(v.datum, "yyyy-MM-dd"))?.omzet;
          if (fdOmzet !== undefined) basis = fdOmzet;
        }
      }
      const verwacht = basis !== null ? basis * (groei ?? 1) : null;
      rows.push({
        datum: d,
        vorigOmzet: basis,
        verwacht,
        feestdag: f?.naam ?? null,
        feestdagImpact: f?.impact ?? null,
      });
    }
    const totaal = rows.reduce((s, r) => s + (r.verwacht ?? 0), 0);
    return { rows, totaal, groei };
  }, [dagIndex]);
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
    <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="card relative overflow-hidden text-left w-full transition-transform active:scale-[0.99] hover:brightness-110 cursor-pointer"
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

      <div className="flex items-center justify-between mt-3 gap-3">
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Tip: check je rooster voor {format(alert.datum, "d MMM", { locale: nl })} —
          {alert.impact === "dicht"
            ? " sluit op tijd, geen open-uren plannen."
            : " plan extra capaciteit voor de drukte."}
        </p>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider shrink-0" style={{ color: hex }}>
          14-d
          <ChevronRight size={12} />
        </span>
      </div>
    </button>

    <DetailSheet
      open={open}
      onClose={() => setOpen(false)}
      titel={`Forecast · komende 14 dagen`}
      subtitel={
        forecast14.groei !== null
          ? `Projectie met +${Math.round((forecast14.groei - 1) * 100)}% YoY-groei toegepast`
          : "Projectie op basis van zelfde-datum vorig jaar"
      }
      hex={hex}
    >
      <div className="space-y-3">
        <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
            Totaal verwacht
          </p>
          <p
            className="font-display text-[28px] font-semibold tabular-nums leading-tight"
            style={{ color: hex, letterSpacing: "-0.018em" }}
          >
            {fmtEur(forecast14.totaal)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            Som van alle dagen hieronder · feestdagen krijgen automatisch de feestdag-vergelijking
          </p>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sf-hairline)" }}>
          {forecast14.rows.map((r, i) => {
            const isFeestdag = r.feestdag !== null;
            const isDicht = r.feestdagImpact === "dicht";
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--sf-hairline)",
                  background: isFeestdag ? `${hex}08` : "transparent",
                }}
              >
                <div className="w-14 shrink-0">
                  <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    {format(r.datum, "EEE", { locale: nl })}
                  </p>
                  <p className="font-display text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {format(r.datum, "d MMM", { locale: nl })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  {isFeestdag && (
                    <span
                      className="inline-block font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded mb-0.5"
                      style={{
                        background: isDicht ? "rgba(255,61,92,0.15)" : `${hex}25`,
                        color: isDicht ? "var(--sf-danger)" : hex,
                      }}
                    >
                      {r.feestdag}
                    </span>
                  )}
                  <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                    {r.vorigOmzet !== null
                      ? `vorig jaar: ${fmtEur(r.vorigOmzet)}`
                      : "geen referentie"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.verwacht !== null ? (
                    <>
                      <p
                        className="font-display text-[16px] font-semibold tabular-nums leading-tight"
                        style={{ color: isDicht ? "var(--sf-danger)" : hex, letterSpacing: "-0.018em" }}
                      >
                        {isDicht ? "—" : fmtEur(r.verwacht)}
                      </p>
                      <p className="font-mono text-[9px]" style={{ color: "var(--muted)" }}>
                        {isDicht ? "dicht" : "verwacht"}
                      </p>
                    </>
                  ) : (
                    <p className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Verwachte waarden zijn een schatting op basis van historische data.
          Echte cijfers kunnen afwijken door weer, evenementen of toeristenstromen.
        </p>
      </div>
    </DetailSheet>
    </>
  );
}
