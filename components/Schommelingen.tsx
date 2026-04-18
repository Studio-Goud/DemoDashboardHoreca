"use client";

interface Schommeling {
  datum: string;
  omzet: number;
  type: "piek" | "dal";
  afwijking: number;
}

interface Props {
  data: Schommeling[];
}

export default function Schommelingen({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-2 text-slate-700">Opvallende schommelingen</h3>
        <p className="text-slate-400 text-sm">Nog onvoldoende data voor analyse.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-slate-700">Opvallende schommelingen</h3>
      <div className="space-y-3">
        {data.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{s.type === "piek" ? "📈" : "📉"}</span>
              <div>
                <p className="text-sm font-medium">
                  {s.type === "piek" ? "Uitschieter omhoog" : "Dip in omzet"}
                </p>
                <p className="text-xs text-slate-400">{s.datum}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">€{s.omzet.toFixed(2)}</p>
              <p
                className={`text-xs ${
                  s.type === "piek" ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {s.afwijking > 0 ? "+" : ""}
                {s.afwijking}% vs gemiddeld
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
