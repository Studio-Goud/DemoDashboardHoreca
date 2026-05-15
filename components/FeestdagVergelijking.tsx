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
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { vergelijkbareFeestdagen } from "@/lib/feestdagen";

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

  return (
    <div
      className="card relative overflow-hidden"
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

      <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>
        Vergelijkt met dezelfde feestdag in eerdere jaren (niet dezelfde
        kalenderdatum). {huidig.naam} viel vorig jaar op{" "}
        {vorigJaar ? format(vorigJaar.datum, "EEEE d MMM", { locale: nl }) : "—"},
        {voorvorigJaar
          ? ` voorvorig jaar op ${format(voorvorigJaar.datum, "EEEE d MMM", { locale: nl })}.`
          : "."}
      </p>
    </div>
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
