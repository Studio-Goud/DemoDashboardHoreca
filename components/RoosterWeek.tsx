"use client";

import { useState } from "react";
import type { DagBezetting } from "@/lib/rooster";
import Icon from "./Icon";
import { useT } from "@/lib/i18n/useT";

interface Props {
  dagen: DagBezetting[];
  hex: string;
}

const DAG_KORT_KEYS = [
  "weekday.sun_short",
  "weekday.mon_short",
  "weekday.tue_short",
  "weekday.wed_short",
  "weekday.thu_short",
  "weekday.fri_short",
  "weekday.sat_short",
];

function isVandaag(iso: string): boolean {
  const vandaag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
  return iso === vandaag;
}

export default function RoosterWeek({ dagen, hex }: Props) {
  const { t } = useT();
  const eerste7 = dagen.slice(0, 7);
  const [open, setOpen] = useState<string | null>(null);

  if (eerste7.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="calendar" size={16} className="opacity-70" />
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
            {t("schedule.this_week")}
          </h2>
        </div>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("schedule.week_no_publish")}
        </p>
      </div>
    );
  }

  const maxUren = Math.max(...eerste7.map((d) => d.totaalUren), 1);
  const openDag = open ? eerste7.find((d) => d.datum === open) : null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="calendar" size={16} className="opacity-70" />
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
            {t("schedule.this_week")}
          </h2>
        </div>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("schedule.tap_day_for_details")}
        </span>
      </div>

      {/* Dagen-strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {eerste7.map((d) => {
          const isActief = open === d.datum;
          const isToday = isVandaag(d.datum);
          const pct = (d.totaalUren / maxUren) * 100;

          return (
            <button
              key={d.datum}
              onClick={() => setOpen(isActief ? null : d.datum)}
              className="relative flex flex-col items-stretch p-2 rounded-[10px] transition-all text-left"
              style={{
                background: isActief ? `${hex}14` : "var(--bg)",
                border: `1px solid ${
                  isActief ? `${hex}55` : isToday ? `${hex}33` : "var(--hairline)"
                }`,
              }}
            >
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{
                  color: isToday ? hex : "var(--muted)",
                  fontWeight: isToday ? 600 : 500,
                }}
              >
                {t(DAG_KORT_KEYS[d.weekdag])}
              </span>
              <span
                className="text-[15px] font-semibold tabular-nums leading-tight"
                style={{ color: "var(--text)" }}
              >
                {d.datum.slice(8)}
              </span>

              {/* Mini bezetting-bar */}
              <div
                className="mt-1.5 h-1 rounded-full overflow-hidden"
                style={{ background: "var(--hairline-2)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: isActief || isToday ? hex : `${hex}88`,
                  }}
                />
              </div>

              <span
                className="text-[10px] tabular-nums mt-1"
                style={{ color: "var(--muted)" }}
              >
                {d.aantalMensen}p · {d.totaalUren.toFixed(0)}u
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail-paneel */}
      {openDag && (
        <div
          className="rounded-[10px] p-3 fade-up"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--hairline)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
              {openDag.label}
            </p>
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              {openDag.aantalMensen} {openDag.aantalMensen === 1 ? t("schedule.person_singular") : t("schedule.person_plural")} · {openDag.totaalUren.toFixed(1)}u
            </p>
          </div>

          <div className="space-y-1">
            {openDag.diensten.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md"
                style={{ background: "var(--bg-elev)" }}
              >
                <span className="text-[12px] truncate" style={{ color: "var(--text)" }}>
                  {d.medewerker.voornaam}{" "}
                  <span style={{ color: "var(--muted)" }}>
                    {d.medewerker.naam.split(" ").slice(-1)[0]}
                  </span>
                </span>
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {d.start} – {d.eind} · {d.uren.toFixed(1)}u
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
