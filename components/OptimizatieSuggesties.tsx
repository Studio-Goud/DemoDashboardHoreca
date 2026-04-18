"use client";

interface Props {
  suggesties: string[];
}

export default function OptimizatieSuggesties({ suggesties }: Props) {
  if (suggesties.length === 0) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-4 text-white/80">💡 Optimalisatiesuggesties</h3>
      <ul className="space-y-3">
        {suggesties.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="text-yellow-400 mt-0.5 shrink-0">→</span>
            <span className="text-white/70">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
