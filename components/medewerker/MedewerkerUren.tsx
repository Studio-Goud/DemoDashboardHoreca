"use client";

import Link from "next/link";
import Icon from "../Icon";

interface Dienst {
  id: string;
  datum: string;
  start: string;
  eind: string;
  pauzeMin: number;
  gepubliceerd: boolean;
  type: string;
  vestiging: { naam: string; hex: string };
}

interface Props {
  maandLabel: string;
  huidigeMaandIso: string;
  vorigeMaandIso: string;
  volgendeMaandIso: string;
  diensten: Dienst[];
}

function urenVoor(d: Dienst): number {
  const [sh, sm] = d.start.split(":").map(Number);
  const [eh, em] = d.eind.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm - d.pauzeMin) / 60);
}

const DAG_KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
function weekdag(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export default function MedewerkerUren({
  maandLabel, huidigeMaandIso, vorigeMaandIso, volgendeMaandIso, diensten,
}: Props) {
  const totaalUren = diensten.reduce((s, d) => s + urenVoor(d), 0);
  const aantalDiensten = diensten.length;
  // Per vestiging
  const perVestiging = new Map<string, { naam: string; hex: string; uren: number; aantal: number }>();
  for (const d of diensten) {
    const key = d.vestiging.naam;
    const e = perVestiging.get(key) ?? { naam: d.vestiging.naam, hex: d.vestiging.hex, uren: 0, aantal: 0 };
    e.uren += urenVoor(d);
    e.aantal += 1;
    perVestiging.set(key, e);
  }

  return (
    <div className="space-y-4">
      {/* Maand-navigator */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`?maand=${vorigeMaandIso}`}
          className="segmented-item"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
        >
          <Icon name="chevron-right" size={14} className="rotate-180" />
        </Link>
        <p className="text-[15px] font-semibold capitalize" style={{ color: "var(--text)" }}>
          {maandLabel}
        </p>
        <Link
          href={`?maand=${volgendeMaandIso}`}
          className="segmented-item"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
        >
          <Icon name="chevron-right" size={14} />
        </Link>
      </div>

      {/* Totaal */}
      <div className="card">
        <p className="eyebrow">Totaal deze maand</p>
        <p className="text-[32px] font-semibold tabular-nums" style={{ color: "var(--text)", letterSpacing: "-0.022em" }}>
          {totaalUren.toFixed(1)}u
        </p>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {aantalDiensten} {aantalDiensten === 1 ? "dienst" : "diensten"}
        </p>
      </div>

      {/* Per vestiging */}
      {perVestiging.size > 1 && (
        <div className="card space-y-2">
          <p className="eyebrow mb-1">Per vestiging</p>
          {Array.from(perVestiging.values()).map((v) => (
            <div key={v.naam} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: v.hex }} />
                <span className="text-[13px]" style={{ color: "var(--text)" }}>{v.naam}</span>
              </span>
              <span className="text-[13px] tabular-nums" style={{ color: "var(--text-2)" }}>
                {v.uren.toFixed(1)}u · {v.aantal}×
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lijst van diensten */}
      <div className="card">
        <p className="eyebrow mb-2">Overzicht</p>
        {diensten.length === 0 ? (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--muted)" }}>
            Geen diensten in {maandLabel.toLowerCase()}
          </p>
        ) : (
          <div className="space-y-1.5">
            {diensten.map((d) => {
              const wd = weekdag(d.datum);
              const [, mm, dd] = d.datum.split("-");
              const uren = urenVoor(d);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 py-1.5"
                  style={{ opacity: d.gepubliceerd ? 1 : 0.55 }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-md"
                      style={{ background: `${d.vestiging.hex}1A`, color: d.vestiging.hex, minWidth: 56, textAlign: "center" }}
                    >
                      {DAG_KORT[wd]} {parseInt(dd)}/{parseInt(mm)}
                    </span>
                    <span className="text-[12px] tabular-nums" style={{ color: "var(--text)" }}>
                      {d.start}–{d.eind}
                    </span>
                  </div>
                  <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--muted)" }}>
                    {uren.toFixed(1)}u
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
        Wij betalen vakantiegeld en vakantie-uren direct uit met je uurloon — dus deze uren zijn je
        bruto basis.
      </p>
    </div>
  );
}
