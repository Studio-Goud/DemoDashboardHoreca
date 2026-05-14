"use client";

import { useEffect, useState, useCallback } from "react";

type Slug = "bb" | "sl" | "kl";

interface PrestatieRegel {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  uren: number;
  omzet: number;
  transacties: number;
  gemBonbedrag: number;
  omzetPerUur: number;
}

interface Rapport {
  jaar: number;
  maand: number;
  perMedewerker: PrestatieRegel[];
  teamGemiddelden: { omzetPerUur: number; gemBonbedrag: number };
  totaal: { uren: number; omzet: number; transacties: number };
}

interface Props {
  bedrijf: Slug;
  hex: string;
}

const MAANDEN = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtKort(n: number): string {
  return "€" + Math.round(n).toLocaleString("nl-NL");
}

export default function PersoneelPrestaties({ bedrijf, hex }: Props) {
  const nu = new Date();
  const [jaar, setJaar] = useState(nu.getFullYear());
  const [maand, setMaand] = useState(nu.getMonth() + 1);
  const [data, setData] = useState<Rapport | null>(null);
  const [laden, setLaden] = useState(true);
  const [sortBy, setSortBy] = useState<keyof PrestatieRegel>("omzetPerUur");

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const res = await fetch(`/api/personeel-prestaties/${bedrijf}?jaar=${jaar}&maand=${maand}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLaden(false);
    }
  }, [bedrijf, jaar, maand]);

  useEffect(() => { laad(); }, [laad]);

  if (laden && !data) {
    return (
      <div className="card">
        <div className="h-32 bg-slate-50 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const sortedRegels = [...data.perMedewerker].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    return typeof av === "number" && typeof bv === "number" ? bv - av : 0;
  });

  const vorigeMaand = () => {
    if (maand === 1) { setMaand(12); setJaar(jaar - 1); }
    else { setMaand(maand - 1); }
  };
  const volgendeMaand = () => {
    if (maand === 12) { setMaand(1); setJaar(jaar + 1); }
    else { setMaand(maand + 1); }
  };

  // Max-waarde voor de bar-charts
  const maxOmzetPerUur = Math.max(...sortedRegels.map((r) => r.omzetPerUur), 1);

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="eyebrow mb-0.5">Personeel-prestaties</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            🏆 {MAANDEN[maand - 1]} {jaar}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={vorigeMaand} className="text-xs px-2 py-1 rounded border border-slate-200">‹</button>
          <span className="text-xs tabular-nums w-20 text-center" style={{ color: "var(--muted)" }}>
            {String(maand).padStart(2, "0")}-{jaar}
          </span>
          <button onClick={volgendeMaand} className="text-xs px-2 py-1 rounded border border-slate-200">›</button>
        </div>
      </div>

      {/* Team-totalen */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg p-2" style={{ background: "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Team uren</p>
          <p className="text-[14px] font-semibold tabular-nums">{data.totaal.uren.toFixed(0)}u</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Omzet/uur</p>
          <p className="text-[14px] font-semibold tabular-nums">{fmtKort(data.teamGemiddelden.omzetPerUur)}</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: "var(--bg)" }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Gem. bon</p>
          <p className="text-[14px] font-semibold tabular-nums">{fmt(data.teamGemiddelden.gemBonbedrag)}</p>
        </div>
      </div>

      {sortedRegels.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Geen rooster-data voor deze maand. Personeel-prestaties worden bepaald door
          transacties te koppelen aan medewerkers die op dat moment ingeroosterd waren —
          dus zonder rooster geen toerekening.
        </p>
      ) : (
        <>
          {/* Sort-toggle */}
          <div className="flex flex-wrap gap-1 mb-2 text-[10px]">
            {(["omzetPerUur", "uren", "omzet", "gemBonbedrag"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className="px-2 py-0.5 rounded-full transition-all"
                style={{
                  background: sortBy === k ? hex : "var(--bg-elev)",
                  color: sortBy === k ? "#fff" : "var(--text-2)",
                  border: sortBy === k ? "none" : "1px solid var(--hairline)",
                }}
              >
                {k === "omzetPerUur" ? "€/uur" : k === "uren" ? "Uren" : k === "omzet" ? "Omzet" : "Gem. bon"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {sortedRegels.map((r, idx) => {
              const breedte = (r.omzetPerUur / maxOmzetPerUur) * 100;
              const bovenGem = r.omzetPerUur > data.teamGemiddelden.omzetPerUur;
              return (
                <div key={r.medewerkerId} className="relative">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                      <span className="text-slate-400 text-[10px] mr-1">{idx + 1}.</span>
                      {r.voornaam} {r.achternaam}
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: bovenGem ? "#30B26F" : "var(--muted)" }}>
                      {fmtKort(r.omzetPerUur)}/u {bovenGem && "↑"}
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elev)" }}>
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all"
                      style={{ width: `${breedte}%`, background: hex, opacity: 0.7 }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
                    <span>{r.uren.toFixed(1)}u</span>
                    <span>{fmt(r.omzet)} omzet</span>
                    <span>{r.transacties}× bonnen</span>
                    <span className="ml-auto">gem. {fmt(r.gemBonbedrag)}/bon</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="text-[10px] mt-3" style={{ color: "var(--muted)" }}>
        Omzet wordt op tijd-basis verdeeld over medewerkers die volgens het rooster
        aanwezig waren tijdens elke transactie. Gelijke verdeling over collega&apos;s
        in dezelfde shift. Approximatie — niet geschikt voor strikt afrekenen, wel voor
        trends en functioneringsgesprekken.
      </p>
    </div>
  );
}
