"use client";

interface Props {
  suggesties: string[];
}

export default function OptimizatieSuggesties({ suggesties }: Props) {
  if (suggesties.length === 0) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-slate-700">💡 Optimalisatiesuggesties</h3>
      <ul className="space-y-3">
        {suggesties.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="text-amber-500 mt-0.5 shrink-0">→</span>
            <span className="text-slate-600">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
