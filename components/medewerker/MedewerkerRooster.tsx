"use client";

import Icon from "../Icon";

interface Dienst {
  id: string;
  datum: string;
  start: string;
  eind: string;
  pauzeMin: number;
  notitie: string;
  shiftType: string;
  vestiging: { slug: string; naam: string; hex: string };
}

interface Props {
  naam: string;
  diensten: Dienst[];
  vandaag: string;
}

const DAG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
const MAAND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function weekdag(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function dagLabel(iso: string, vandaag: string): string {
  if (iso === vandaag) return "Vandaag";
  const morgen = new Date(vandaag);
  morgen.setUTCDate(new Date(vandaag).getUTCDate() + 1);
  const morgenIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(morgen);
  if (iso === morgenIso) return "Morgen";
  const [, m, d] = iso.split("-");
  return `${DAG[weekdag(iso)]} ${parseInt(d)} ${MAAND[parseInt(m) - 1]}`;
}

function urenVoor(d: Dienst): number {
  const [sh, sm] = d.start.split(":").map(Number);
  const [eh, em] = d.eind.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm - d.pauzeMin) / 60);
}

export default function MedewerkerRooster({ naam, diensten, vandaag }: Props) {
  // Groepeer per datum
  const perDag = new Map<string, Dienst[]>();
  for (const d of diensten) {
    const lijst = perDag.get(d.datum) ?? [];
    lijst.push(d);
    perDag.set(d.datum, lijst);
  }
  const dagen = Array.from(perDag.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const totaalUren = diensten.reduce((s, d) => s + urenVoor(d), 0);

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="eyebrow">Komende 2 weken</p>
        <p className="text-[28px] font-semibold tabular-nums leading-tight" style={{ color: "var(--text)" }}>
          {diensten.length}
        </p>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {diensten.length === 1 ? "dienst" : "diensten"} · {totaalUren.toFixed(1)}u totaal
        </p>
      </div>

      {dagen.length === 0 ? (
        <div className="card text-center py-8">
          <Icon name="calendar-clock" size={28} className="mx-auto opacity-30 mb-2" />
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            Geen diensten gepland voor de komende 2 weken
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {dagen.map(([datum, dagDiensten]) => {
            const isToday = datum === vandaag;
            return (
              <div
                key={datum}
                className="card"
                style={{
                  borderColor: isToday ? `${dagDiensten[0].vestiging.hex}55` : undefined,
                }}
              >
                <div className="flex items-baseline justify-between mb-2.5">
                  <p
                    className="text-[14px] font-semibold"
                    style={{ color: isToday ? dagDiensten[0].vestiging.hex : "var(--text)" }}
                  >
                    {dagLabel(datum, vandaag)}
                  </p>
                  <p className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
                    {dagDiensten.reduce((s, d) => s + urenVoor(d), 0).toFixed(1)}u
                  </p>
                </div>
                <div className="space-y-2">
                  {dagDiensten.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-[10px]"
                      style={{
                        background: `${d.vestiging.hex}10`,
                        border: `1px solid ${d.vestiging.hex}33`,
                      }}
                    >
                      <div className="min-w-0">
                        <p
                          className="text-[15px] font-semibold tabular-nums"
                          style={{ color: d.vestiging.hex }}
                        >
                          {d.start} – {d.eind}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                          {d.vestiging.naam}{d.shiftType ? ` · ${d.shiftType}` : ""}
                        </p>
                        {d.notitie && (
                          <p className="text-[11px] mt-0.5 italic" style={{ color: "var(--muted)" }}>
                            {d.notitie}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-2)" }}>
                        {urenVoor(d).toFixed(1)}u
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
