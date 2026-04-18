import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-2">Studio Goud</h1>
        <p className="text-white/50 text-lg">Omzetoverzicht & Business Intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <Link href="/bb" className="group">
          <div className="card border-bb-primary/30 hover:border-bb-primary/80 transition-all duration-300 hover:bg-bb-primary/10 cursor-pointer">
            <div className="text-5xl mb-4">☕</div>
            <h2 className="text-2xl font-bold text-bb-primary mb-2">Brunch & Brew</h2>
            <p className="text-white/50 text-sm">
              Omzetanalyse · Piekuren · Producten · Prognose
            </p>
            <div className="mt-4 text-bb-primary/70 text-sm group-hover:text-bb-primary transition-colors">
              Dashboard bekijken →
            </div>
          </div>
        </Link>

        <Link href="/sl" className="group">
          <div className="card border-sl-primary/30 hover:border-sl-primary/80 transition-all duration-300 hover:bg-sl-primary/10 cursor-pointer">
            <div className="text-5xl mb-4">🍢</div>
            <h2 className="text-2xl font-bold text-sl-primary mb-2">Saté Lounge</h2>
            <p className="text-white/50 text-sm">
              Omzetanalyse · Piekuren · Producten · Prognose
            </p>
            <div className="mt-4 text-sl-primary/70 text-sm group-hover:text-sl-primary transition-colors">
              Dashboard bekijken →
            </div>
          </div>
        </Link>
      </div>

      <p className="mt-12 text-white/20 text-xs">
        Data via SumUp API · Historische Zettle data via CSV upload
      </p>
    </main>
  );
}
