import Link from "next/link";

/**
 * Index voor de boot-sequence demo's. Drie varianten om te vergelijken.
 * Elke variant draait standalone op zijn eigen URL en eindigt op een
 * "landed" home-mock zodat je het ambient effect kan beoordelen.
 */
export default function DevIndex() {
  const varianten = [
    {
      slug: "boot-1",
      titel: "01 — Grid Render",
      ondertitel: "Cyan rasterlijnen, scan-sweep, blur-logo",
      vibe: "Linear · Vision Pro · Arc",
    },
    {
      slug: "boot-2",
      titel: "02 — Particle Constellation",
      ondertitel: "200 deeltjes converteren tot vorm, cursor-reactief",
      vibe: "Arrival · heptapod",
    },
    {
      slug: "boot-3",
      titel: "03 — HUD Boot Sequence",
      ondertitel: "Monospace readout met scan-sweep + glitch-logo",
      vibe: "Death Stranding · Blade Runner 2049",
    },
  ];

  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <div className="mb-12">
        <p className="font-mono text-[11px] tracking-[0.15em] uppercase mb-4"
           style={{ color: "var(--sf-fg-muted)" }}>
          FASE 3 · WOW Opening Demos
        </p>
        <h1 className="font-display text-sf-display tracking-tight"
            style={{ color: "var(--sf-fg)" }}>
          Pick your year.
        </h1>
        <p className="font-display text-sf-body mt-3 max-w-md"
           style={{ color: "var(--sf-fg-muted)" }}>
          Drie varianten van de app-opening, elk ~1.5s.
          Eindigen op dezelfde "landed" home-mock zodat je het ambient effect kan beoordelen.
          Klik om te starten — herlaad de pagina om opnieuw te zien.
        </p>
      </div>

      <ul className="space-y-3">
        {varianten.map((v) => (
          <li key={v.slug}>
            <Link
              href={`/dev/${v.slug}`}
              className="group block p-5 rounded-sf-lg transition-all duration-sf-base ease-sf-snap"
              style={{
                background: "var(--sf-bg-surface)",
                border: "1px solid var(--sf-hairline)",
              }}
            >
              <div className="flex items-baseline justify-between gap-4 mb-1">
                <h2 className="font-display text-sf-h2"
                    style={{ color: "var(--sf-fg)" }}>
                  {v.titel}
                </h2>
                <span className="font-mono text-[10px] tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--sf-accent)" }}>
                  RUN →
                </span>
              </div>
              <p className="text-sf-small mb-2" style={{ color: "var(--sf-fg-muted)" }}>
                {v.ondertitel}
              </p>
              <p className="font-mono text-[10px] tracking-wider uppercase"
                 style={{ color: "var(--sf-fg-dim)" }}>
                {v.vibe}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sf-small text-center"
         style={{ color: "var(--sf-fg-dim)" }}>
        Tip — open elke variant op je iPhone om de werkelijke ervaring te zien.
      </p>
    </main>
  );
}
