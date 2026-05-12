"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";

type Status = "vrij" | "beperkt" | "niet";

interface Item {
  datum: string;
  status: Status;
  start: string | null;
  eind:  string | null;
  reden: string;
}

const DAG_KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MAAND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function vandaagISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}
function plusDagen(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(dt);
}
function weekdag(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export default function MedewerkerBeschikbaarheid() {
  const vandaag = vandaagISO();
  const eind = plusDagen(vandaag, 28);
  const datums = Array.from({ length: 29 }, (_, i) => plusDagen(vandaag, i));

  const [map, setMap] = useState<Record<string, Item>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function laden() {
    try {
      const res = await fetch(`/api/medewerker/beschikbaarheid?start=${vandaag}&eind=${eind}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { items: Item[] };
        setMap(Object.fromEntries(j.items.map((i) => [i.datum, i])));
      }
    } catch {
      // stil
    }
  }

  useEffect(() => { laden(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function zetStatus(datum: string, status: Status, start?: string, eind?: string) {
    setBusy(datum);
    try {
      await fetch("/api/medewerker/beschikbaarheid", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum, status, start, eind }),
      });
      await laden();
      setOpen(null);
    } finally {
      setBusy(null);
    }
  }

  async function wis(datum: string) {
    setBusy(datum);
    try {
      await fetch(`/api/medewerker/beschikbaarheid?datum=${datum}`, { method: "DELETE" });
      await laden();
      setOpen(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <p className="eyebrow">Beschikbaarheid komende 4 weken</p>
        <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
          Tap een dag om aan te geven of je beschikbaar bent. Standaard: niet opgegeven.
        </p>
      </div>

      <div className="space-y-1.5">
        {datums.map((datum) => {
          const item = map[datum];
          const isOpen = open === datum;
          const [, mm, dd] = datum.split("-");
          const wd = weekdag(datum);
          const datumLabel = `${DAG_KORT[wd]} ${parseInt(dd)} ${MAAND[parseInt(mm) - 1]}`;
          const isToday = datum === vandaag;

          let statusKleur = "var(--muted)";
          let statusBg = "var(--bg)";
          let statusLabel = "Niet opgegeven";
          if (item?.status === "vrij")    { statusKleur = "#30B26F"; statusBg = "rgba(48,178,111,0.10)"; statusLabel = "Hele dag beschikbaar"; }
          if (item?.status === "beperkt") { statusKleur = "#30B26F"; statusBg = "rgba(48,178,111,0.06)"; statusLabel = `Beschikbaar ${item.start ?? "?"}–${item.eind ?? "?"}`; }
          if (item?.status === "niet")    { statusKleur = "#E5484D"; statusBg = "rgba(229,72,77,0.10)"; statusLabel = "Niet beschikbaar"; }

          return (
            <div
              key={datum}
              className="rounded-[10px] overflow-hidden transition-all"
              style={{ background: statusBg, border: `1px solid ${isToday ? "var(--hairline)" : "var(--hairline-2)"}` }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : datum)}
                className="w-full flex items-center justify-between px-3 py-3 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="text-[13px] font-semibold tabular-nums"
                    style={{ color: "var(--text)", minWidth: 80 }}
                  >
                    {datumLabel}
                    {isToday && <span className="ml-1.5 text-[10px] opacity-70">vandaag</span>}
                  </span>
                  <span className="text-[12px] truncate" style={{ color: statusKleur }}>
                    {statusLabel}
                  </span>
                </div>
                <Icon name="chevron-down" size={14} className={isOpen ? "rotate-180" : ""} />
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 fade-up">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <Knop kleur="#30B26F" label="Vrij" onClick={() => zetStatus(datum, "vrij")} actief={item?.status === "vrij"} disabled={busy === datum} />
                    <Knop kleur="#E07A1F" label="Tijden" onClick={() => {
                      // default tijden invullen, gebruiker past aan via popup
                      const start = item?.start ?? "10:00";
                      const eind  = item?.eind  ?? "18:00";
                      const sIn = prompt("Vanaf welk tijdstip beschikbaar? (HH:MM)", start);
                      if (!sIn) return;
                      const eIn = prompt("Tot welk tijdstip beschikbaar? (HH:MM)", eind);
                      if (!eIn) return;
                      zetStatus(datum, "beperkt", sIn, eIn);
                    }} actief={item?.status === "beperkt"} disabled={busy === datum} />
                    <Knop kleur="#E5484D" label="Niet" onClick={() => zetStatus(datum, "niet")} actief={item?.status === "niet"} disabled={busy === datum} />
                  </div>
                  {item && (
                    <button
                      onClick={() => wis(datum)}
                      disabled={busy === datum}
                      className="text-[12px] underline"
                      style={{ color: "var(--muted)" }}
                    >
                      Wissen (geen voorkeur)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Knop({ kleur, label, onClick, actief, disabled }: {
  kleur: string; label: string; onClick: () => void; actief: boolean; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="py-2.5 rounded-[10px] text-[13px] font-medium transition-all disabled:opacity-50"
      style={{
        background: actief ? kleur : "var(--bg-elev)",
        color: actief ? "white" : "var(--text)",
        border: `1px solid ${actief ? kleur : "var(--hairline)"}`,
      }}
    >
      {label}
    </button>
  );
}
