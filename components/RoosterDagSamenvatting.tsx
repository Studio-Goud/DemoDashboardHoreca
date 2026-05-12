"use client";

import type { Dienst, Medewerker } from "@/lib/shiftbase";

interface Props {
  weekDatums: string[];        // 7 dagen, ma → zo
  diensten: Dienst[];
  medewerkers: Medewerker[];
  vandaag: string;
  hex: string;
  onKlikDag?: (datum: string) => void;
}

const DAG_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function fmtKortDatum(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Avatar({ medewerker, size = 18 }: { medewerker: Medewerker; size?: number }) {
  const isPlaceholder = !medewerker.avatar || medewerker.avatar.includes("user-picture_");
  const initialen =
    (medewerker.voornaam?.[0] ?? "") +
    (medewerker.achternaam?.[0] ?? "");
  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        background: "var(--hairline)",
        fontSize: 9,
        fontWeight: 600,
        color: "var(--text-2)",
      }}
    >
      {!isPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={medewerker.avatar} alt={medewerker.naam} className="w-full h-full object-cover" />
      ) : (
        initialen.toUpperCase()
      )}
    </span>
  );
}

export default function RoosterDagSamenvatting({
  weekDatums, diensten, medewerkers, vandaag, hex, onKlikDag,
}: Props) {
  const medewerkerById = new Map(medewerkers.map((m) => [m.id, m] as const));

  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {weekDatums.map((datum, i) => {
          const isToday = datum === vandaag;
          const dagDiensten = diensten
            .filter((d) => d.datum === datum)
            .sort((a, b) => a.start.localeCompare(b.start));
          const uniekeMensen = new Set(dagDiensten.map((d) => d.medewerker.id)).size;
          const totaalUren = dagDiensten.reduce((s, d) => s + d.uren, 0);

          // Bouw lijst, dedup op user (mensen met meerdere shifts samenvoegen)
          const perUser = new Map<string, Dienst[]>();
          for (const d of dagDiensten) {
            const lijst = perUser.get(d.medewerker.id) ?? [];
            lijst.push(d);
            perUser.set(d.medewerker.id, lijst);
          }

          return (
            <button
              key={datum}
              onClick={() => onKlikDag?.(datum)}
              className="flex flex-col text-left p-3 transition-colors hover:bg-[var(--bg)]"
              style={{
                borderRight: i < 6 ? "1px solid var(--hairline-2)" : "none",
                borderBottom: "1px solid var(--hairline-2)",
                background: isToday ? `${hex}08` : "transparent",
                minHeight: 130,
              }}
            >
              {/* Dag-header */}
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-wider"
                    style={{
                      color: isToday ? hex : "var(--muted)",
                      fontWeight: isToday ? 700 : 500,
                    }}
                  >
                    {DAG_KORT[i]}
                  </p>
                  <p
                    className="text-[15px] font-semibold tabular-nums leading-tight"
                    style={{ color: isToday ? hex : "var(--text)" }}
                  >
                    {fmtKortDatum(datum)}
                  </p>
                </div>
                {dagDiensten.length > 0 && (
                  <span
                    className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full"
                    style={{ background: `${hex}1A`, color: hex }}
                  >
                    {uniekeMensen}p · {totaalUren.toFixed(0)}u
                  </span>
                )}
              </div>

              {/* Lijst met diensten */}
              {dagDiensten.length === 0 ? (
                <p className="text-[11px] mt-2" style={{ color: "var(--muted)", opacity: 0.6 }}>
                  Geen diensten
                </p>
              ) : (
                <ul className="space-y-1">
                  {Array.from(perUser.entries()).map(([userId, shifts]) => {
                    const m = medewerkerById.get(userId);
                    if (!m) return null;
                    const allConcept = shifts.every((s) => !s.gepubliceerd);
                    return (
                      <li
                        key={userId}
                        className="flex items-center gap-1.5"
                        style={{ opacity: allConcept ? 0.6 : 1 }}
                      >
                        <Avatar medewerker={m} size={18} />
                        <span
                          className="text-[11px] font-medium truncate"
                          style={{ color: "var(--text)" }}
                        >
                          {m.voornaam}
                        </span>
                        <span
                          className="text-[10px] tabular-nums ml-auto shrink-0"
                          style={{ color: "var(--muted)" }}
                        >
                          {shifts.length === 1
                            ? `${shifts[0].start}–${shifts[0].eind}`
                            : `${shifts.length} diensten`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
