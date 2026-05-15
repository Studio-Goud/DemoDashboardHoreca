"use client";

/**
 * Toont jaar-op-jaar vergelijking voor feestdagen, gebaseerd op NAAM
 * van de feestdag (niet de kalenderdatum). Pasen/Koningsdag schuiven
 * elke jaar — vergelijking op kalenderdatum is dan misleidend.
 *
 * Toont alleen iets als:
 *   1. De peildatum (default vandaag) is een feestdag
 *   2. Er omzet-data bestaat voor dezelfde feestdag in vorig en/of
 *      voorvorig jaar
 *
 * Anders rendert 'ie null — geen ruis op het dashboard.
 */
import { useMemo, useState } from "react";
import { format, parseISO, subYears } from "date-fns";
import { nl } from "date-fns/locale";
import { vergelijkbareFeestdagen, zoekFeestdagInJaar } from "@/lib/feestdagen";
import DetailSheet from "./sf/DetailSheet";
import { ChevronRight } from "lucide-react";

interface DagOmzet {
  datum: string;        // YYYY-MM-DD
  omzet: number;
}

interface Props {
  /** Voor welke datum de vergelijking. Default: vandaag. */
  peilDatum?: Date;
  /** Hele dagOmzet-historie (zelfde shape als Vergelijken-component). */
  dagOmzet: DagOmzet[];
  /** Vestiging-accent voor highlight. */
  hex: string;
}

function fmtEur(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function deltaPct(huidig: number, vorig: number): number {
  if (vorig === 0) return 0;
  return Math.round(((huidig - vorig) / vorig) * 1000) / 10;
}

export default function FeestdagVergelijking({ peilDatum, dagOmzet, hex }: Props) {
  const [open, setOpen] = useState(false);
  const datum = peilDatum ?? new Date();
  const dagIndex = useMemo(() => new Map(dagOmzet.map((d) => [d.datum, d])), [dagOmzet]);

  const vergelijking = vergelijkbareFeestdagen(datum);
  if (!vergelijking) return null;

  const { huidig, vorigJaar, voorvorigJaar } = vergelijking;

  // Omzet-data voor elke datum
  const huidigKey = format(huidig.datum, "yyyy-MM-dd");
  const huidigOmzet = dagIndex.get(huidigKey)?.omzet ?? null;
  const vorigOmzet = vorigJaar ? dagIndex.get(format(vorigJaar.datum, "yyyy-MM-dd"))?.omzet ?? null : null;
  const voorvorigOmzet = voorvorigJaar ? dagIndex.get(format(voorvorigJaar.datum, "yyyy-MM-dd"))?.omzet ?? null : null;

  // Niets tonen als we GEEN historische vergelijking kunnen maken
  if (vorigOmzet === null && voorvorigOmzet === null) return null;

  // Bouw uitgebreide historische rij voor de drill-down: tot 5 jaar terug.
  const langereHistorie: Array<{ jaar: number; datum: Date | null; omzet: number | null }> = [];
  for (let jr = huidig.datum.getFullYear() - 1; jr >= huidig.datum.getFullYear() - 5; jr--) {
    const f = zoekFeestdagInJaar(huidig.naam, jr);
    if (!f) {
      langereHistorie.push({ jaar: jr, datum: null, omzet: null });
      continue;
    }
    const omz = dagIndex.get(format(f.datum, "yyyy-MM-dd"))?.omzet ?? null;
    langereHistorie.push({ jaar: jr, datum: f.datum, omzet: omz });
  }
  const beschikbareHist = langereHistorie.filter((h) => h.omzet !== null).map((h) => h.omzet as number);
  const gemHist = beschikbareHist.length > 0 ? beschikbareHist.reduce((s, v) => s + v, 0) / beschikbareHist.length : 0;
  const maxOmzet = Math.max(huidigOmzet ?? 0, ...beschikbareHist, 1);

  return (
    <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="card relative overflow-hidden text-left w-full transition-transform active:scale-[0.99] hover:brightness-110 cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${hex}10 0%, transparent 100%)`,
        border: `1px solid ${hex}30`,
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p
            className="font-mono text-[10px] tracking-[0.18em] uppercase mb-1"
            style={{ color: hex }}
          >
            🎉 Feestdag-vergelijking
          </p>
          <h3
            className="font-display text-[16px] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {huidig.naam}
          </h3>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background:
              huidig.impact === "dicht" ? "rgba(255,61,92,0.15)" :
              huidig.impact === "hoog" ? "rgba(0,229,255,0.15)" :
              huidig.impact === "middel" ? "rgba(255,184,0,0.15)" :
              "rgba(142,142,147,0.15)",
            color:
              huidig.impact === "dicht" ? "var(--sf-danger)" :
              huidig.impact === "hoog" ? "var(--sf-accent)" :
              huidig.impact === "middel" ? "var(--sf-warning)" :
              "var(--muted)",
          }}
        >
          impact: {huidig.impact}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <FeestdagKolom
          label="Vandaag"
          datum={huidig.datum}
          omzet={huidigOmzet}
          isHuidig
          hex={hex}
        />
        <FeestdagKolom
          label="1 jaar terug"
          datum={vorigJaar?.datum ?? null}
          omzet={vorigOmzet}
          delta={huidigOmzet !== null && vorigOmzet !== null && vorigOmzet > 0
            ? deltaPct(huidigOmzet, vorigOmzet)
            : null}
          hex={hex}
        />
        <FeestdagKolom
          label="2 jaar terug"
          datum={voorvorigJaar?.datum ?? null}
          omzet={voorvorigOmzet}
          delta={huidigOmzet !== null && voorvorigOmzet !== null && voorvorigOmzet > 0
            ? deltaPct(huidigOmzet, voorvorigOmzet)
            : null}
          hex={hex}
        />
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Vergelijkt met dezelfde feestdag in eerdere jaren (niet dezelfde
          kalenderdatum). {huidig.naam} viel vorig jaar op{" "}
          {vorigJaar ? format(vorigJaar.datum, "EEEE d MMM", { locale: nl }) : "—"}.
        </p>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider shrink-0" style={{ color: hex }}>
          5 jr
          <ChevronRight size={12} />
        </span>
      </div>
    </button>

    <DetailSheet
      open={open}
      onClose={() => setOpen(false)}
      titel={huidig.naam}
      subtitel={`Vergelijking 5 jaar terug · impact ${huidig.impact}`}
      hex={hex}
    >
      <div className="space-y-4">
        <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
            Vandaag
          </p>
          <p
            className="font-display text-[28px] font-semibold tabular-nums leading-tight"
            style={{ color: hex, letterSpacing: "-0.018em" }}
          >
            {huidigOmzet !== null ? fmtEur(huidigOmzet) : "—"}
          </p>
          {huidigOmzet !== null && beschikbareHist.length >= 2 && (
            <p className="font-mono text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              {huidigOmzet > gemHist ? "+" : ""}
              {Math.round(((huidigOmzet - gemHist) / gemHist) * 100)}% t.o.v. 5-jaars gemiddelde van {fmtEur(gemHist)}
            </p>
          )}
        </div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--muted)" }}>
            Historie
          </p>
          <div className="space-y-1.5">
            {[{ jaar: huidig.datum.getFullYear(), datum: huidig.datum, omzet: huidigOmzet }, ...langereHistorie].map((h, i) => {
              const isHuidig = i === 0;
              const pct = h.omzet !== null ? (h.omzet / maxOmzet) * 100 : 0;
              return (
                <div key={h.jaar} className="flex items-center gap-3">
                  <div className="w-12 shrink-0">
                    <p
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: isHuidig ? hex : "var(--muted)" }}
                    >
                      {h.jaar}
                    </p>
                  </div>
                  <div className="flex-1 h-7 rounded-md overflow-hidden relative" style={{ background: "var(--sf-hairline)" }}>
                    {h.omzet !== null && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: isHuidig ? hex : `${hex}55`,
                        }}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span
                        className="font-mono text-[11px] tabular-nums"
                        style={{ color: h.omzet !== null ? "var(--text)" : "var(--muted)" }}
                      >
                        {h.omzet !== null ? fmtEur(h.omzet) : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                      {h.datum ? format(h.datum, "d MMM", { locale: nl }) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Omdat {huidig.naam} elk jaar op een andere kalenderdatum kan vallen
          (Pasen/Pinksteren schuiven, Koningsdag bij zondag → 26 april), vergelijken
          we op naam — niet op datum. Zo blijft de vergelijking eerlijk.
        </p>
      </div>
    </DetailSheet>
    </>
  );
}

function FeestdagKolom({
  label,
  datum,
  omzet,
  delta,
  isHuidig,
  hex,
}: {
  label: string;
  datum: Date | null;
  omzet: number | null;
  delta?: number | null;
  isHuidig?: boolean;
  hex: string;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: isHuidig ? `${hex}14` : "var(--bg)",
        border: `1px solid ${isHuidig ? `${hex}40` : "var(--hairline)"}`,
      }}
    >
      <p
        className="font-mono text-[9px] tracking-wider uppercase mb-1"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      {datum && (
        <p className="font-mono text-[10px] mb-1.5 tabular-nums" style={{ color: "var(--muted)" }}>
          {format(datum, "d MMM yyyy", { locale: nl })}
        </p>
      )}
      <p
        className="font-display text-[18px] font-semibold tabular-nums leading-tight"
        style={{
          color: omzet !== null ? "var(--text)" : "var(--muted)",
          letterSpacing: "-0.018em",
        }}
      >
        {omzet !== null ? fmtEur(omzet) : "—"}
      </p>
      {delta !== null && delta !== undefined && (
        <p
          className="font-mono text-[11px] tabular-nums mt-0.5"
          style={{
            color: delta > 0 ? "var(--sf-success)" : delta < 0 ? "var(--sf-danger)" : "var(--muted)",
          }}
        >
          {delta > 0 ? "+" : ""}{delta}%
        </p>
      )}
    </div>
  );
}

/**
 * Helper-export: ja/nee functie om te checken of we vandaag de
 * vergelijking moeten tonen — voor parent-components die conditionally
 * willen renderen.
 */
export function heeftFeestdagVergelijking(peilDatum: Date, dagOmzet: DagOmzet[]): boolean {
  const v = vergelijkbareFeestdagen(peilDatum);
  if (!v) return false;
  const dagIndex = new Map(dagOmzet.map((d) => [d.datum, d]));
  const vorig = v.vorigJaar ? dagIndex.get(format(v.vorigJaar.datum, "yyyy-MM-dd")) : undefined;
  const voorvorig = v.voorvorigJaar ? dagIndex.get(format(v.voorvorigJaar.datum, "yyyy-MM-dd")) : undefined;
  return !!(vorig || voorvorig);
}
