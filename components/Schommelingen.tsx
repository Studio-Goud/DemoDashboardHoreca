"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import type { Schommeling } from "@/lib/analytics";

interface Props {
  data: Schommeling[];
}

export default function Schommelingen({ data }: Props) {
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
          <div key={i} className="py-2 flex items-center gap-3">
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
          </div>
        ))}
      </div>
    </div>
  );
}
