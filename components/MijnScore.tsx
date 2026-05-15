"use client";

/**
 * Eigen score op /m — toont rang + score per bedrijf waar de medewerker
 * gekoppeld is. Inclusief "wie staat boven mij" als gentle nudge.
 * Geen details van andere medewerkers buiten degene direct boven.
 */
import { useEffect, useState } from "react";
import { Trophy, Star, TrendingUp, Loader2, ChevronUp } from "lucide-react";
import type { ScoreRij } from "@/lib/medewerker-score";

interface BedrijfScore {
  bedrijfSlug: string;
  bedrijfNaam: string;
  hex: string;
  totaalDeelnemers: number;
  score: ScoreRij | null;
  bovenMij: { rang: number; voornaam: string; totaalScore: number } | null;
}

export default function MijnScore() {
  const [data, setData] = useState<BedrijfScore[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    let actief = true;
    fetch("/api/m/mijn-score")
      .then(async (r) => {
        if (!r.ok) throw new Error("Kon score niet laden");
        return r.json();
      })
      .then((d) => { if (actief) setData(d.perBedrijf ?? []); })
      .catch((e) => { if (actief) setFout(e.message); });
    return () => { actief = false; };
  }, []);

  if (fout) return null;
  if (data === null) {
    return (
      <div className="card flex items-center gap-2 justify-center py-6">
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--sf-accent, #00E5FF)" }} />
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>Score berekenen…</span>
      </div>
    );
  }
  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      {data.map((b) => (
        <div key={b.bedrijfSlug} className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: b.hex }} />
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: b.hex }}>
                {b.bedrijfNaam}
              </p>
            </div>
            <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
              30d
            </span>
          </div>

          {!b.score ? (
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Nog geen shifts of reviews in de afgelopen 30 dagen.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mb-3">
                <div
                  className="font-display font-semibold tabular-nums"
                  style={{ color: b.hex, fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}
                >
                  {Math.round(b.score.totaalScore)}
                </div>
                <div>
                  <p className="font-display text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                    #{b.score.rang}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                    van {b.totaalDeelnemers}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ background: "var(--card-bg, rgba(255,255,255,0.04))" }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <Star size={10} style={{ color: "var(--muted)" }} />
                    <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                      Reviews
                    </p>
                  </div>
                  <p className="font-display text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {b.score.reviewsAantal}
                    <span className="text-[10px] font-mono ml-1" style={{ color: "var(--muted)" }}>
                      ({b.score.gemSterren ? b.score.gemSterren.toFixed(1) : "—"}★)
                    </span>
                  </p>
                </div>
                <div
                  className="p-2 rounded-lg"
                  style={{ background: "var(--card-bg, rgba(255,255,255,0.04))" }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp size={10} style={{ color: "var(--muted)" }} />
                    <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                      Omzet/uur
                    </p>
                  </div>
                  <p className="font-display text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    €{Math.round(b.score.omzetPerUur)}
                  </p>
                </div>
              </div>

              {b.bovenMij && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
                  style={{ background: `${b.hex}10`, color: "var(--text)" }}
                >
                  <ChevronUp size={12} style={{ color: b.hex }} />
                  <span>
                    Nog <strong>{Math.round(b.bovenMij.totaalScore - b.score.totaalScore)}</strong> punten tot {b.bovenMij.voornaam} (#{b.bovenMij.rang})
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
