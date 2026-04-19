"use client";

import type { DagOmzet, Prognose } from "@/lib/analytics";
import type { Bedrijf } from "@/lib/sumup";

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
    label: "Marathon Rotterdam 🏃",
    kleur: "#f87171",
    shifts: [
      { start: "09:30", eind: "20:00", rol: "opener" },
      { start: "09:30", eind: "20:00", rol: "opener" },
      { start: "12:00", eind: "20:00", rol: "middag" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  sl: {
    label: "Marathon Rotterdam 🏃",
    kleur: "#f87171",
    shifts: [
      { start: "10:00", eind: "20:00", rol: "opener" },
      { start: "10:00", eind: "20:00", rol: "opener" },
      { start: "14:00", eind: "20:00", rol: "sluiter" },
    ],
  },
  kl: {
    label: "Marathon Rotterdam 🏃",
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

export default function BezettingAdvies({ hex, bedrijf, dagOmzet, prognose, geplandVandaag }: Props) {
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
    if (diff < 0) return { ok: false, tekst: `${Math.abs(diff)} te weinig gepland` };
    if (diff > 0) return { ok: true,  tekst: `${diff} meer dan nodig` };
    return { ok: true, tekst: "bezetting klopt" };
  })();

  return (
    <div className="card space-y-4" style={{ borderColor: hex + "33" }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">👥</span>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: hex }}>
          Personeelsadvies vandaag
        </h2>
      </div>

      {/* Drukte-banner */}
      <div
        className="rounded-lg px-4 py-3 flex items-center justify-between gap-4"
        style={{ background: template.kleur + "18", borderLeft: `3px solid ${template.kleur}` }}
      >
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Verwachte drukte</p>
          <p className="text-base font-bold" style={{ color: template.kleur }}>
            {template.label}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Verwacht {vandaagPrognose.verwacht > 0
              ? "€" + vandaagPrognose.verwacht.toLocaleString("nl-NL", { maximumFractionDigits: 0 })
              : "–"}{vandaagPrognose.feestdag ? ` · ${vandaagPrognose.feestdag}` : ""}
          </p>
        </div>

        {status && (
          <div className="text-right shrink-0">
            <p
              className="text-xl font-bold font-mono"
              style={{ color: status.ok ? "#4ade80" : "#f87171" }}
            >
              {status.ok ? "✓" : "⚠"}
            </p>
            <p className="text-[11px] text-slate-400">{status.tekst}</p>
          </div>
        )}
      </div>

      {/* Shift-indeling */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
          Aanbevolen indeling — {aanbevolen} {aanbevolen === 1 ? "persoon" : "mensen"}
        </p>
        <div className="space-y-1.5">
          {template.shifts.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full"
                style={{ background: ROL_KLEUR[s.rol] + "20", color: ROL_KLEUR[s.rol] }}
              >
                {s.start} – {s.eind}
              </span>
              <span className="text-[11px] text-slate-500 capitalize">{s.rol}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
