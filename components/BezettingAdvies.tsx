"use client";

import { useState } from "react";
import type { DagOmzet, Prognose } from "@/lib/analytics";
import type { Bedrijf } from "@/lib/sumup";
import Icon from "./Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";
import DetailSheet from "./sf/DetailSheet";

interface ShiftSlot {
  start: string;
  eind: string;
  rol: "opener" | "middag" | "sluiter";
}

interface DrukteTemplate {
  label: string;
  kleur: string;
  shifts: ShiftSlot[];
}

// Vaste shift-templates per vestiging, gebaseerd op werkelijk personeelsbeleid
const TEMPLATES: Record<Bedrijf, Record<"normaal" | "druk" | "extreem", DrukteTemplate>> = {
  bb: {
    normaal: {
      label: "Normaal",
      kleur: "#4ade80",
      shifts: [
        { start: "09:30", eind: "15:00", rol: "opener" },
        { start: "09:30", eind: "16:00", rol: "opener" },
      ],
    },
    druk: {
      label: "Druk",
      kleur: "#fbbf24",
      shifts: [
        { start: "09:30", eind: "15:00", rol: "opener" },
        { start: "09:30", eind: "15:00", rol: "opener" },
        { start: "13:00", eind: "20:00", rol: "middag" },
        { start: "16:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    extreem: {
      label: "Extreem druk",
      kleur: "#f87171",
      shifts: [
        { start: "09:30", eind: "18:00", rol: "opener" },
        { start: "09:30", eind: "18:00", rol: "opener" },
        { start: "12:00", eind: "18:00", rol: "middag" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
  },
  sl: {
    normaal: {
      label: "Normaal",
      kleur: "#4ade80",
      shifts: [
        { start: "10:00", eind: "20:00", rol: "opener" },
      ],
    },
    druk: {
      label: "Druk",
      kleur: "#fbbf24",
      shifts: [
        { start: "10:00", eind: "16:00", rol: "opener" },
        { start: "12:00", eind: "20:00", rol: "middag" },
        { start: "16:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    extreem: {
      label: "Extreem druk",
      kleur: "#f87171",
      shifts: [
        { start: "10:00", eind: "20:00", rol: "opener" },
        { start: "10:00", eind: "16:00", rol: "opener" },
        { start: "12:00", eind: "20:00", rol: "middag" },
        { start: "16:00", eind: "20:00", rol: "sluiter" },
      ],
    },
  },
  kl: {
    normaal: {
      label: "Normaal",
      kleur: "#4ade80",
      shifts: [
        { start: "10:00", eind: "15:00", rol: "opener" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    druk: {
      label: "Druk",
      kleur: "#fbbf24",
      shifts: [
        { start: "10:00", eind: "15:00", rol: "opener" },
        { start: "12:00", eind: "18:00", rol: "middag" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
    extreem: {
      label: "Extreem druk",
      kleur: "#f87171",
      shifts: [
        { start: "10:00", eind: "15:00", rol: "opener" },
        { start: "10:00", eind: "16:00", rol: "opener" },
        { start: "12:00", eind: "18:00", rol: "middag" },
        { start: "12:00", eind: "20:00", rol: "middag" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
        { start: "15:00", eind: "20:00", rol: "sluiter" },
      ],
    },
  },
};

// Zondag: altijd 2 mensen, heel de dag
const ZONDAG_TEMPLATES: Record<Bedrijf, DrukteTemplate> = {
  bb: {
    label: "Zondag",
    kleur: "#94a3b8",
    shifts: [
      { start: "09:30", eind: "16:00", rol: "opener" },
      { start: "13:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  sl: {
    label: "Zondag",
    kleur: "#94a3b8",
    shifts: [
      { start: "10:00", eind: "16:00", rol: "opener" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  kl: {
    label: "Zondag",
    kleur: "#94a3b8",
    shifts: [
      { start: "10:00", eind: "15:00", rol: "opener" },
      { start: "15:00", eind: "20:00", rol: "sluiter" },
    ],
  },
};

// Marathon Rotterdam: extreem — BB 4 man, SL 3 man, KL 3 man
const MARATHON_TEMPLATES: Record<Bedrijf, DrukteTemplate> = {
  bb: {
    label: "Marathon Rotterdam",
    kleur: "#f87171",
    shifts: [
      { start: "09:30", eind: "20:00", rol: "opener" },
      { start: "09:30", eind: "20:00", rol: "opener" },
      { start: "12:00", eind: "20:00", rol: "middag" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  sl: {
    label: "Marathon Rotterdam",
    kleur: "#f87171",
    shifts: [
      { start: "10:00", eind: "20:00", rol: "opener" },
      { start: "10:00", eind: "20:00", rol: "opener" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  kl: {
    label: "Marathon Rotterdam",
    kleur: "#f87171",
    shifts: [
      { start: "10:00", eind: "15:00", rol: "opener" },
      { start: "12:00", eind: "18:00", rol: "middag" },
      { start: "15:00", eind: "20:00", rol: "sluiter" },
    ],
  },
};

const ROL_KLEUR: Record<ShiftSlot["rol"], string> = {
  opener:  "#60a5fa",
  middag:  "#a78bfa",
  sluiter: "#34d399",
};

interface Props {
  hex: string;
  bedrijf: Bedrijf;
  dagOmzet: DagOmzet[];
  prognose: Prognose[];
  geplandVandaag: number | null;
}

// Bepaal drukte-niveau op basis van historische omzet-percentielen voor die weekdag
function bepaalDrukte(
  verwacht: number,
  weekdag: number,
  dagOmzet: DagOmzet[]
): "normaal" | "druk" | "extreem" {
  if (weekdag === 6) return "extreem"; // zaterdag altijd extreem

  const zelfde = dagOmzet
    .filter((d) => new Date(d.datum).getDay() === weekdag && d.omzet > 0)
    .map((d) => d.omzet)
    .sort((a, b) => a - b);

  if (zelfde.length < 4) return "normaal";

  const p60 = zelfde[Math.floor(zelfde.length * 0.60)];
  const p80 = zelfde[Math.floor(zelfde.length * 0.80)];

  if (verwacht >= p80) return "extreem";
  if (verwacht >= p60) return "druk";
  return "normaal";
}

const LABEL_KEY: Record<string, string> = {
  "Normaal": "bezetting.normal",
  "Druk": "bezetting.busy",
  "Extreem druk": "bezetting.very_busy",
  "Zondag": "bezetting.sunday",
};

const ROL_KEY: Record<ShiftSlot["rol"], string> = {
  opener: "bezetting.role_opener",
  middag: "bezetting.role_middag",
  sluiter: "bezetting.role_sluiter",
};

export default function BezettingAdvies({ hex, bedrijf, dagOmzet, prognose, geplandVandaag }: Props) {
  const { t } = useTaal();
  const [open, setOpen] = useState(false);
  const vandaagStr = new Date().toISOString().slice(0, 10);
  const vandaagPrognose = prognose.find((p) => p.datum === vandaagStr);

  if (!vandaagPrognose) return null;

  const isMarathon = vandaagPrognose.feestdag?.includes("Marathon") ?? false;
  const isZondag   = vandaagPrognose.weekdag === 0;

  const template = isMarathon
    ? MARATHON_TEMPLATES[bedrijf]
    : isZondag
    ? ZONDAG_TEMPLATES[bedrijf]
    : TEMPLATES[bedrijf][bepaalDrukte(vandaagPrognose.verwacht, vandaagPrognose.weekdag, dagOmzet)];
  const aanbevolen = template.shifts.length;

  const status = (() => {
    if (geplandVandaag === null) return null;
    const diff = geplandVandaag - aanbevolen;
    if (diff < 0) return { ok: false, tekst: t("bezetting.too_few").replace("{n}", String(Math.abs(diff))) };
    if (diff > 0) return { ok: true,  tekst: t("bezetting.too_many").replace("{n}", String(diff)) };
    return { ok: true, tekst: t("bezetting.ok") };
  })();

  const templateLabel = LABEL_KEY[template.label] ? t(LABEL_KEY[template.label]) : template.label;

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="users" size={16} className="opacity-70" />
        <h2 className="text-[13px] font-semibold tracking-wide" style={{ color: "var(--text-2)" }}>
          {t("bezetting.title")}
        </h2>
      </div>

      {/* Drukte-banner — klikbaar voor uitleg */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[10px] px-4 py-3 flex items-center justify-between gap-4 w-full text-left transition-transform active:scale-[0.99] hover:brightness-110 cursor-pointer"
        style={{
          background: template.kleur + "12",
          borderLeft: `2px solid ${template.kleur}`,
        }}
      >
        <div>
          <p className="eyebrow mb-0.5">{t("bezetting.expected")}</p>
          <p className="text-[15px] font-semibold" style={{ color: template.kleur }}>
            {templateLabel}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
            {t("bezetting.expected_word")} {vandaagPrognose.verwacht > 0
              ? "€" + vandaagPrognose.verwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })
              : "–"}{vandaagPrognose.feestdag ? ` · ${vandaagPrognose.feestdag}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <div className="text-right flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                style={{
                  background: status.ok ? "#30B26F22" : "#E07A1F22",
                  color: status.ok ? "#30B26F" : "#E07A1F",
                }}
              >
                <Icon name={status.ok ? "check" : "alert"} size={16} strokeWidth={2.2} />
              </span>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>{status.tekst}</p>
            </div>
          )}
          <Icon name="chevron-right" size={14} className="opacity-40" />
        </div>
      </button>

      {/* Shift-indeling */}
      <div>
        <p className="eyebrow mb-2">
          {t("bezetting.recommended")} {aanbevolen} {aanbevolen === 1 ? t("schedule.person_singular") : t("schedule.person_plural")}
        </p>
        <div className="space-y-1.5">
          {template.shifts.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-md"
                style={{ background: ROL_KLEUR[s.rol] + "1A", color: ROL_KLEUR[s.rol] }}
              >
                {s.start} – {s.eind}
              </span>
              <span className="text-[12px] capitalize" style={{ color: "var(--muted)" }}>
                {t(ROL_KEY[s.rol])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        titel={`Vandaag: ${templateLabel}`}
        subtitel={`Verwachte omzet €${vandaagPrognose.verwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`}
        hex={template.kleur}
      >
        <div className="space-y-4">
          <div className="rounded-2xl p-4" style={{ background: `${template.kleur}15`, border: `1px solid ${template.kleur}40` }}>
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: template.kleur }}>
              Aanbevolen bezetting
            </p>
            <p
              className="font-display text-[40px] font-semibold tabular-nums leading-none"
              style={{ color: template.kleur, letterSpacing: "-0.018em" }}
            >
              {aanbevolen}
            </p>
            <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
              {aanbevolen === 1 ? t("schedule.person_singular") : t("schedule.person_plural")}
              {geplandVandaag !== null && ` · ingepland: ${geplandVandaag}`}
            </p>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--muted)" }}>
              Waarom {templateLabel.toLowerCase()}?
            </p>
            <div className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--sf-hairline)" }}>
              {isMarathon ? (
                <p className="text-[12px]" style={{ color: "var(--text)" }}>
                  🏃 Vandaag is er een marathon — historisch is dat een uitzonderlijk drukke dag.
                  Speciale marathon-template wordt toegepast.
                </p>
              ) : isZondag ? (
                <p className="text-[12px]" style={{ color: "var(--text)" }}>
                  📅 Zondagen hebben een afwijkend patroon — andere openingstijden en/of
                  drukteverdeling. Speciale zondag-template wordt toegepast.
                </p>
              ) : (
                <>
                  <p className="text-[12px]" style={{ color: "var(--text)" }}>
                    Drukte wordt bepaald door de verwachte omzet voor vandaag (€{vandaagPrognose.verwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })})
                    af te zetten tegen vergelijkbare dagen in de historie.
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Boven de 80e percentiel = extreem druk · 60–80% = druk · daaronder = normaal.
                  </p>
                </>
              )}
              {vandaagPrognose.feestdag && (
                <p className="text-[12px]" style={{ color: "var(--sf-accent)" }}>
                  🎉 Feestdag: <strong>{vandaagPrognose.feestdag}</strong>
                </p>
              )}
              {vandaagPrognose.vakantie && (
                <p className="text-[12px]" style={{ color: "var(--sf-accent)" }}>
                  🏖 Schoolvakantie: <strong>{vandaagPrognose.vakantie}</strong>
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--muted)" }}>
              Volledige shift-indeling
            </p>
            <div className="space-y-1.5">
              {template.shifts.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ border: "1px solid var(--sf-hairline)" }}
                >
                  <span
                    className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-md shrink-0"
                    style={{ background: ROL_KLEUR[s.rol] + "1A", color: ROL_KLEUR[s.rol] }}
                  >
                    {s.start} – {s.eind}
                  </span>
                  <span className="text-[12px] capitalize" style={{ color: "var(--text)" }}>
                    {t(ROL_KEY[s.rol])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Deze template is geen automatisch rooster — gebruik het als richtlijn naast je
            eigen kennis van personeel-beschikbaarheid en specifieke dagdetails.
          </p>
        </div>
      </DetailSheet>
    </div>
  );
}
