"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import type { Schommeling } from "@/lib/analytics";
import DetailSheet from "./sf/DetailSheet";
import { ChevronRight } from "lucide-react";

interface Props {
  data: Schommeling[];
}

export default function Schommelingen({ data }: Props) {
  const [geselecteerd, setGeselecteerd] = useState<Schommeling | null>(null);

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-1 text-slate-700">
          Opvallende schommelingen
        </h3>
        <p className="text-[11px] text-slate-400">
          Vergelijking dag-op-dag: werkdagen tegen gem. zelfde weekdag, feestdagen
          tegen zelfde feestdag vorig jaar.
        </p>
        <p className="text-slate-400 text-sm mt-3">
          Geen significante afwijkingen (&gt; 25%) in de laatste 60 dagen.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold text-slate-700">
          Opvallende schommelingen
        </h3>
        <span className="text-[11px] text-slate-400">
          ≥ 25% vs zelfde-dag referentie
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Werkdagen worden vergeleken met gem. zelfde weekdag (laatste 8 weken,
        excl. feestdagen). Feestdagen tegen zelfde feestdag vorig jaar.
      </p>
      <div className="divide-y divide-slate-100">
        {data.map((s, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setGeselecteerd(s)}
            className="py-2 flex items-center gap-3 w-full text-left hover:bg-slate-50 transition-colors -mx-2 px-2 rounded-lg"
          >
            <div
              className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                s.type === "piek"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {s.type === "piek" ? "▲" : "▼"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {format(parseISO(s.datum), "EEEE dd-MM-yyyy", { locale: nl })}
                {s.feestdag && (
                  <span className="ml-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    {s.feestdag}
                  </span>
                )}
                {!s.feestdag && s.vakantie && (
                  <span className="ml-2 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                    vakantie
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400">{s.context}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold tabular-nums text-slate-800">
                €{s.omzet.toFixed(0)}
              </p>
              <p
                className={`text-[11px] tabular-nums ${
                  s.type === "piek" ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {s.afwijking > 0 ? "+" : ""}
                {s.afwijking}% · ref €{s.referentie.toFixed(0)}
              </p>
            </div>
            <ChevronRight size={14} className="shrink-0 text-slate-300" />
          </button>
        ))}
      </div>

      <DetailSheet
        open={geselecteerd !== null}
        onClose={() => setGeselecteerd(null)}
        titel={geselecteerd ? (geselecteerd.type === "piek" ? "Piek-dag" : "Dal-dag") : ""}
        subtitel={
          geselecteerd
            ? format(parseISO(geselecteerd.datum), "EEEE d MMMM yyyy", { locale: nl })
            : ""
        }
        hex={geselecteerd?.type === "piek" ? "#10b981" : "#ef4444"}
      >
        {geselecteerd && <SchommelingDetail s={geselecteerd} />}
      </DetailSheet>
    </div>
  );
}

function SchommelingDetail({ s }: { s: Schommeling }) {
  const isPiek = s.type === "piek";
  const accent = isPiek ? "#10b981" : "#ef4444";
  const verschil = s.omzet - s.referentie;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: `${accent}10`, border: `1px solid ${accent}30` }}>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: accent }}>
          Afwijking
        </p>
        <p
          className="font-display text-[36px] font-semibold tabular-nums leading-none"
          style={{ color: accent, letterSpacing: "-0.018em" }}
        >
          {s.afwijking > 0 ? "+" : ""}{s.afwijking}%
        </p>
        <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          {verschil > 0 ? "+" : ""}€{Math.round(Math.abs(verschil))} t.o.v. de referentie
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            Deze dag
          </p>
          <p
            className="font-display text-[22px] font-semibold tabular-nums leading-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
          >
            €{s.omzet.toFixed(0)}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {format(parseISO(s.datum), "d MMM yyyy", { locale: nl })}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            Referentie
          </p>
          <p
            className="font-display text-[22px] font-semibold tabular-nums leading-tight"
            style={{ color: "var(--muted)", letterSpacing: "-0.018em" }}
          >
            €{s.referentie.toFixed(0)}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {s.context}
          </p>
        </div>
      </div>

      {(s.feestdag || s.vakantie) && (
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
            Context
          </p>
          {s.feestdag && (
            <p className="text-[12px]" style={{ color: "var(--text)" }}>
              🎉 <strong>{s.feestdag}</strong> — vergelijking is feestdag-aware (zelfde feestdag vorig jaar, niet zelfde kalenderdatum).
            </p>
          )}
          {!s.feestdag && s.vakantie && (
            <p className="text-[12px]" style={{ color: "var(--text)" }}>
              🏖 <strong>{s.vakantie}</strong> — schoolvakantie kan reguliere weekdag-patronen verstoren.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        {isPiek
          ? "Onderzoek wat goed werkte — was er een evenement, mooi weer, of een specifieke campagne? Patronen kun je herhalen."
          : "Onderzoek wat de oorzaak was — slecht weer, sluiting, personeelstekort, of iets onvoorziens? Zorg dat je het volgende keer kunt opvangen."}
      </p>
    </div>
  );
}
