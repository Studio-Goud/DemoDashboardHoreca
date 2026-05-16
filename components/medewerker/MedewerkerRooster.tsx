"use client";

import { useState } from "react";
import Icon from "../Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";
import type { Taal } from "@/lib/i18n/dictionaries";
import RuilverzoekModal from "./RuilverzoekModal";

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

const DAG_PER_TAAL: Record<Taal, string[]> = {
  nl: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  pt: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
};
const MAAND_PER_TAAL: Record<Taal, string[]> = {
  nl: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
};

function weekdag(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function dagLabel(iso: string, vandaag: string, taal: Taal, t: (k: string) => string): string {
  if (iso === vandaag) return t("common.today");
  const morgen = new Date(vandaag);
  morgen.setUTCDate(new Date(vandaag).getUTCDate() + 1);
  const morgenIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(morgen);
  if (iso === morgenIso) return t("common.tomorrow");
  const [, m, d] = iso.split("-");
  return `${DAG_PER_TAAL[taal][weekdag(iso)]} ${parseInt(d)} ${MAAND_PER_TAAL[taal][parseInt(m) - 1]}`;
}

function urenVoor(d: Dienst): number {
  const [sh, sm] = d.start.split(":").map(Number);
  const [eh, em] = d.eind.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm - d.pauzeMin) / 60);
}

export default function MedewerkerRooster({ naam, diensten, vandaag }: Props) {
  const { t, taal } = useTaal();
  const [ruilDienst, setRuilDienst] = useState<Dienst | null>(null);
  const [succesId, setSuccesId] = useState<string | null>(null);

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
        <p className="eyebrow">{t("m.next_2_weeks")}</p>
        <p className="text-[28px] font-semibold tabular-nums leading-tight" style={{ color: "var(--text)" }}>
          {diensten.length}
        </p>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {diensten.length === 1 ? t("m.shift_singular") : t("m.shift_plural")} · {totaalUren.toFixed(1)}{t("schedule.total_hours_suffix")}
        </p>
      </div>

      {ruilDienst && (
        <RuilverzoekModal
          rosterId={Number(ruilDienst.id)}
          dienstLabel={`${dagLabel(ruilDienst.datum, vandaag, taal, t)} · ${ruilDienst.start}–${ruilDienst.eind} · ${ruilDienst.vestiging.naam}`}
          hex={ruilDienst.vestiging.hex}
          onAfsluiten={() => setRuilDienst(null)}
          onSucces={() => {
            setSuccesId(ruilDienst.id);
            setRuilDienst(null);
            setTimeout(() => setSuccesId(null), 5000);
          }}
        />
      )}

      {dagen.length === 0 ? (
        <div className="card text-center py-8">
          <Icon name="calendar-clock" size={28} className="mx-auto opacity-30 mb-2" />
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            {t("m.no_shifts_2_weeks")}
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
                    {dagLabel(datum, vandaag, taal, t)}
                  </p>
                  <p className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
                    {dagDiensten.reduce((s, d) => s + urenVoor(d), 0).toFixed(1)}u
                  </p>
                </div>
                <div className="space-y-2">
                  {dagDiensten.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-[10px]"
                      style={{
                        background: `${d.vestiging.hex}10`,
                        border: `1px solid ${d.vestiging.hex}33`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
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
                      {succesId === d.id ? (
                        <p className="text-[11px] mt-2 text-right" style={{ color: "#30B26F" }}>
                          ✓ Ruilverzoek verstuurd naar collega's
                        </p>
                      ) : (
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => setRuilDienst(d)}
                            className="text-[11px] px-2.5 py-1 rounded-full"
                            style={{
                              color: d.vestiging.hex,
                              border: `1px solid ${d.vestiging.hex}55`,
                              background: "transparent",
                            }}
                          >
                            🔄 Ruil aanvragen
                          </button>
                        </div>
                      )}
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
