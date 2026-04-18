"use client";

import type { Prognose } from "@/lib/analytics";

interface Props {
  data: Prognose[];
}

const drukKleur: Record<Prognose["druk"], string> = {
  laag: "bg-white/10 text-white/40",
  normaal: "bg-blue-500/20 text-blue-300",
  druk: "bg-orange-500/20 text-orange-300",
  "zeer druk": "bg-red-500/20 text-red-300",
};

const drukLabel: Record<Prognose["druk"], string> = {
  laag: "Rustig",
  normaal: "Normaal",
  druk: "Druk",
  "zeer druk": "Zeer druk",
};

export default function Forecast({ data }: Props) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-white/80">14-daagse prognose</h3>
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {data.map((dag, i) => (
          <div
            key={i}
            className={`rounded-xl p-3 text-center ${drukKleur[dag.druk]}`}
          >
            <p className="text-xs font-medium mb-1 capitalize">
              {dag.dagNaam.split(" ")[0]}
            </p>
            <p className="text-xs opacity-70 mb-2">
              {dag.dagNaam.split(" ").slice(1).join(" ")}
            </p>
            <p className="text-xs font-semibold">€{dag.verwacht.toFixed(0)}</p>
            <p className="text-xs opacity-60 mt-1">{drukLabel[dag.druk]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
