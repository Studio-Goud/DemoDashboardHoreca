"use client";

/**
 * Eigen score op /m — toont rang + score per bedrijf waar de medewerker
 * gekoppeld is. Inclusief "wie staat boven mij" als gentle nudge.
 * Geen details van andere medewerkers buiten degene direct boven.
 */
import { useEffect, useState } from "react";
import { Trophy, Star, TrendingUp, Loader2, ChevronUp, ChevronRight, Clock } from "lucide-react";
import type { ScoreRij } from "@/lib/medewerker-score";
import DetailSheet from "./sf/DetailSheet";

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
  const [actief, setActief] = useState<BedrijfScore | null>(null);

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
        <button
          type="button"
          key={b.bedrijfSlug}
          onClick={() => b.score && setActief(b)}
          disabled={!b.score}
          className="card text-left w-full transition-transform active:scale-[0.99] enabled:hover:brightness-110 disabled:cursor-default relative">
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
          {b.score && (
            <ChevronRight size={14} className="absolute top-3 right-3 opacity-40" />
          )}
        </button>
      ))}

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief ? `Score · ${actief.bedrijfNaam}` : ""}
        subtitel={
          actief?.score
            ? `Rang #${actief.score.rang} van ${actief.totaalDeelnemers} · laatste 30 dagen`
            : ""
        }
        hex={actief?.hex}
      >
        {actief?.score && <ScoreDetail bedrijf={actief} />}
      </DetailSheet>
    </div>
  );
}

function ScoreDetail({ bedrijf }: { bedrijf: BedrijfScore }) {
  const s = bedrijf.score!;
  const reviewsPct = (s.reviewsBijdrage / 50) * 100;
  const omzetPct = (s.omzetBijdrage / 50) * 100;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: `${bedrijf.hex}10`, border: `1px solid ${bedrijf.hex}30` }}>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: bedrijf.hex }}>
          Mijn score
        </p>
        <div className="flex items-baseline gap-2">
          <p
            className="font-display text-[40px] font-semibold tabular-nums leading-none"
            style={{ color: bedrijf.hex, letterSpacing: "-0.018em" }}
          >
            {Math.round(s.totaalScore)}
          </p>
          <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>/ 100</p>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--sf-hairline)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, s.totaalScore)}%`, background: bedrijf.hex }}
          />
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Star size={11} style={{ color: bedrijf.hex }} />
            <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Reviews-component
            </p>
          </div>
          <p className="font-display text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {Math.round(s.reviewsBijdrage)}<span className="font-mono text-[10px] font-normal" style={{ color: "var(--muted)" }}> /50</span>
          </p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--sf-hairline)" }}>
          <div className="h-full rounded-full" style={{ width: `${reviewsPct}%`, background: bedrijf.hex }} />
        </div>
        <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
          {s.reviewsAantal} reviews · gemiddeld {s.gemSterren?.toFixed(1) ?? "—"}★ — meer reviews + hogere sterren = meer punten
        </p>
      </div>

      <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} style={{ color: bedrijf.hex }} />
            <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Omzet-component
            </p>
          </div>
          <p className="font-display text-[14px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {Math.round(s.omzetBijdrage)}<span className="font-mono text-[10px] font-normal" style={{ color: "var(--muted)" }}> /50</span>
          </p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--sf-hairline)" }}>
          <div className="h-full rounded-full" style={{ width: `${omzetPct}%`, background: bedrijf.hex }} />
        </div>
        <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
          €{Math.round(s.omzetPerUur)}/uur — totaalomzet tijdens jouw shifts ÷ gewerkte uren
        </p>
      </div>

      <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Clock size={11} style={{ color: "var(--muted)" }} />
          <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
            Activiteit
          </p>
        </div>
        <p className="text-[13px]" style={{ color: "var(--text)" }}>
          Je hebt <strong>{Math.round(s.gewerkteUren)} uur</strong> gewerkt in de laatste 30 dagen.
        </p>
      </div>

      {bedrijf.bovenMij && (
        <div className="rounded-xl p-3" style={{ background: `${bedrijf.hex}10`, border: `1px solid ${bedrijf.hex}30` }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ChevronUp size={11} style={{ color: bedrijf.hex }} />
            <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: bedrijf.hex }}>
              Volgende plek
            </p>
          </div>
          <p className="text-[13px]" style={{ color: "var(--text)" }}>
            Nog <strong>{Math.round(bedrijf.bovenMij.totaalScore - s.totaalScore)} punten</strong> tot {bedrijf.bovenMij.voornaam} op plek #{bedrijf.bovenMij.rang}.
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            Tip: meer reviews verzamelen of een drukke shift met hogere omzet/uur kan dat verschil overbruggen.
          </p>
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Score = reviews-bijdrage (max 50) + omzet-bijdrage (max 50). Eerlijke vergelijking
        binnen je bedrijf — niet tussen vestigingen.
      </p>
    </div>
  );
}
