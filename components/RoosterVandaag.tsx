"use client";

import { useEffect, useState } from "react";
import type { Dienst } from "@/lib/rooster";
import Icon from "./Icon";
import { useT } from "@/lib/i18n/useT";

interface Props {
  diensten: Dienst[];
  hex: string;
}

function hhmm(now: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

function vandaagDatumLabel(now: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

// Min in tot eind van shift
function minutenTot(eindOfStart: string, nuHhmm: string): number {
  const [eh, em] = eindOfStart.split(":").map(Number);
  const [nh, nm] = nuHhmm.split(":").map(Number);
  return eh * 60 + em - (nh * 60 + nm);
}

function statusVoor(d: Dienst, nuHhmm: string): "actief" | "komt" | "klaar" {
  if (nuHhmm < d.start) return "komt";
  if (nuHhmm >= d.eind) return "klaar";
  return "actief";
}

function Avatar({ medewerker, ring }: { medewerker: Dienst["medewerker"]; ring?: string }) {
  const isPlaceholder =
    !medewerker.avatar || medewerker.avatar.includes("user-picture_");
  const initialen =
    (medewerker.voornaam?.[0] ?? "") +
    (medewerker.naam.split(" ").slice(-1)[0]?.[0] ?? "");

  return (
    <div
      className="relative shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden"
      style={{
        background: "var(--hairline)",
        boxShadow: ring ? `0 0 0 1.5px ${ring}, 0 0 0 3px var(--bg-elev)` : undefined,
      }}
    >
      {!isPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={medewerker.avatar} alt={medewerker.naam} className="w-full h-full object-cover" />
      ) : (
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: "var(--text-2)" }}
        >
          {initialen}
        </span>
      )}
    </div>
  );
}

function DienstChip({
  dienst,
  status,
  hex,
  nuHhmm,
}: {
  dienst: Dienst;
  status: "actief" | "komt" | "klaar";
  hex: string;
  nuHhmm: string;
}) {
  const { t } = useT();
  const dempkleur = status === "klaar";
  const accent = status === "actief" ? hex : status === "komt" ? "var(--muted)" : "var(--muted)";

  const extra =
    status === "actief"
      ? t("schedule.shift_remaining_min").replace("{min}", String(Math.max(0, minutenTot(dienst.eind, nuHhmm))))
      : status === "komt"
      ? `${t("schedule.starts_at")} ${dienst.start}`
      : `${t("schedule.done_at")} ${dienst.eind}`;

  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] transition-opacity"
      style={{
        background: status === "actief" ? `${hex}10` : "var(--bg)",
        border: `1px solid ${status === "actief" ? `${hex}33` : "var(--hairline)"}`,
        opacity: dempkleur ? 0.55 : 1,
      }}
    >
      <Avatar medewerker={dienst.medewerker} ring={status === "actief" ? hex : undefined} />
      <div className="min-w-0 flex-1">
        <p
          className="text-[12.5px] font-medium truncate"
          style={{ color: "var(--text)" }}
        >
          {dienst.medewerker.voornaam}{" "}
          <span style={{ color: "var(--muted)" }}>
            {dienst.medewerker.naam.split(" ").slice(-1)[0]}
          </span>
        </p>
        <p className="text-[11px] tabular-nums" style={{ color: accent }}>
          {dienst.start} – {dienst.eind} · {extra}
        </p>
      </div>
    </div>
  );
}

export default function RoosterVandaag({ diensten, hex }: Props) {
  const { t } = useT();
  const [now, setNow] = useState(() => new Date());

  // Tikt elke minuut voor live "nog X min"
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nuHhmm = hhmm(now);
  const datumLabel = vandaagDatumLabel(now);

  const gesorteerd = [...diensten].sort((a, b) => a.start.localeCompare(b.start));
  const actief = gesorteerd.filter((d) => statusVoor(d, nuHhmm) === "actief");
  const komt   = gesorteerd.filter((d) => statusVoor(d, nuHhmm) === "komt");
  const klaar  = gesorteerd.filter((d) => statusVoor(d, nuHhmm) === "klaar");

  const totaalUren = diensten.reduce((s, d) => s + d.uren, 0);
  const uniekeMensen = new Set(diensten.map((d) => d.medewerker.id)).size;

  if (diensten.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="calendar-clock" size={16} className="opacity-70" />
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
            {t("schedule.today")}
          </h2>
        </div>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("schedule.no_shifts_for")} {datumLabel.toLowerCase()}.
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="calendar-clock" size={16} className="opacity-70" />
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
            {t("schedule.today")}
          </h2>
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
          {uniekeMensen} {uniekeMensen === 1 ? t("schedule.person_singular") : t("schedule.person_plural")} · {totaalUren.toFixed(1)}{t("schedule.total_hours_suffix")}
        </span>
      </div>

      {/* Tijdas */}
      <Tijdas diensten={diensten} hex={hex} nuHhmm={nuHhmm} />

      {actief.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="w-1.5 h-1.5 rounded-full pulse-soft"
              style={{ background: hex, boxShadow: `0 0 6px ${hex}` }}
            />
            <p className="eyebrow">{t("schedule.now_working")} · {actief.length}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {actief.map((d) => (
              <DienstChip key={d.id} dienst={d} status="actief" hex={hex} nuHhmm={nuHhmm} />
            ))}
          </div>
        </div>
      )}

      {komt.length > 0 && (
        <div>
          <p className="eyebrow mb-2">{t("schedule.coming")} · {komt.length}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {komt.map((d) => (
              <DienstChip key={d.id} dienst={d} status="komt" hex={hex} nuHhmm={nuHhmm} />
            ))}
          </div>
        </div>
      )}

      {klaar.length > 0 && (
        <details className="group">
          <summary
            className="eyebrow cursor-pointer list-none flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            {t("schedule.done")} · {klaar.length}
            <Icon
              name="chevron-down"
              size={12}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {klaar.map((d) => (
              <DienstChip key={d.id} dienst={d} status="klaar" hex={hex} nuHhmm={nuHhmm} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// Visuele tijdas: 8u..22u, met huidige tijd-marker en shift-balken
function Tijdas({
  diensten,
  hex,
  nuHhmm,
}: {
  diensten: Dienst[];
  hex: string;
  nuHhmm: string;
}) {
  const startUur = 8;
  const eindUur = 22;
  const totMin = (eindUur - startUur) * 60;

  const tijdAlsPct = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    const min = (h - startUur) * 60 + m;
    return Math.max(0, Math.min(100, (min / totMin) * 100));
  };

  const nuPct = tijdAlsPct(nuHhmm);

  // Stack overlappende shifts op verschillende "rails"
  const rails: Dienst[][] = [];
  const gesorteerd = [...diensten].sort((a, b) => a.start.localeCompare(b.start));
  for (const d of gesorteerd) {
    let geplaatst = false;
    for (const rail of rails) {
      const laatste = rail[rail.length - 1];
      if (laatste.eind <= d.start) {
        rail.push(d);
        geplaatst = true;
        break;
      }
    }
    if (!geplaatst) rails.push([d]);
  }

  return (
    <div className="relative">
      {/* Uurmarkeringen */}
      <div
        className="relative h-[5px] rounded-full mb-1.5"
        style={{ background: "var(--hairline-2)" }}
      >
        {Array.from({ length: eindUur - startUur + 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${(i / (eindUur - startUur)) * 100}%`,
              background: "var(--hairline)",
            }}
          />
        ))}
      </div>

      {/* Shift-rails */}
      <div className="space-y-1">
        {rails.map((rail, idx) => (
          <div key={idx} className="relative h-[5px]">
            {rail.map((d) => {
              const left = tijdAlsPct(d.start);
              const right = tijdAlsPct(d.eind);
              return (
                <div
                  key={d.id}
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${right - left}%`,
                    background: nuHhmm >= d.eind ? `${hex}30` : `${hex}80`,
                  }}
                  title={`${d.medewerker.voornaam} · ${d.start}–${d.eind}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Nu-marker */}
      <div
        className="absolute top-0 -bottom-0.5 w-px pointer-events-none z-10"
        style={{ left: `${nuPct}%`, background: hex }}
      >
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
          style={{ background: hex, boxShadow: `0 0 6px ${hex}` }}
        />
      </div>

      {/* Uur-labels */}
      <div className="flex justify-between mt-1 text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
        <span>{String(startUur).padStart(2, "0")}:00</span>
        <span>14:00</span>
        <span>18:00</span>
        <span>{String(eindUur).padStart(2, "0")}:00</span>
      </div>
    </div>
  );
}
