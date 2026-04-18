interface Props {
  hex: string;
}

function Block({ h, className = "" }: { h: number; className?: string }) {
  return (
    <div
      className={`bg-slate-100 rounded-lg animate-pulse ${className}`}
      style={{ height: h }}
    />
  );
}

export default function DashboardSkeleton({ hex }: Props) {
  return (
    <div className="space-y-6">
      {/* Live block */}
      <div className="card space-y-3">
        <div
          className="w-24 h-3 rounded animate-pulse"
          style={{ backgroundColor: `${hex}40` }}
        />
        <div
          className="w-48 h-10 rounded animate-pulse"
          style={{ backgroundColor: `${hex}55` }}
        />
        <Block h={16} className="w-40" />
        <Block h={8} className="w-full" />
      </div>

      {/* Kerncijfers */}
      <div className="card">
        <Block h={18} className="w-32 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Block h={10} className="w-20" />
              <Block h={24} className="w-28" />
              <Block h={10} className="w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <Block h={18} className="w-40 mb-3" />
        <Block h={260} className="w-full" />
      </div>

      {/* Vergelijken */}
      <div className="card">
        <Block h={18} className="w-28 mb-3" />
        <Block h={180} className="w-full" />
      </div>

      <p className="text-center text-xs text-slate-400">
        Data wordt opgehaald vanuit SumUp…
      </p>
    </div>
  );
}
