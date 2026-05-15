"use client";

/**
 * Team-combinaties widget — toont top 3 + onder-3 paren over een venster.
 * Owner gebruikt dit signaal om te beslissen welke duo's vaker / minder
 * vaak ingeroosterd moeten worden. Het rooster wordt hier NIET automatisch
 * op aangepast — dat is bewust een handmatige beslissing (Phase A).
 */
import { useEffect, useState } from "react";
import { Users, TrendingUp, TrendingDown, Star, Loader2 } from "lucide-react";
import type { CombiRij } from "@/lib/team-combinaties";

interface Props {
  bedrijfSlug: string;
  hex: string;
}

export default function TeamCombinaties({ bedrijfSlug, hex }: Props) {
  const [rijen, setRijen] = useState<CombiRij[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    let actief = true;
    fetch(`/api/leaderboard/combinaties/${bedrijfSlug}?venster=60`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Kon combinaties niet laden");
        return r.json();
      })
      .then((d) => { if (actief) setRijen(d.rijen ?? []); })
      .catch((e) => { if (actief) setFout(e.message); });
    return () => { actief = false; };
  }, [bedrijfSlug]);

  if (fout) return null;
  if (rijen === null) {
    return (
      <div className="card flex items-center gap-2 justify-center py-6">
        <Loader2 size={14} className="animate-spin" style={{ color: hex }} />
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>Combinaties analyseren…</span>
      </div>
    );
  }
  if (rijen.length < 2) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} style={{ color: hex }} />
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
            Team-combinaties
          </p>
        </div>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Te weinig gezamenlijke shifts in de laatste 60 dagen om patronen te tonen (min. 3 shifts per paar).
        </p>
      </div>
    );
  }

  // Slechtste (zScore < 0, asc) en beste (zScore > 0, desc)
  const slechtste = rijen.filter((r) => r.zScore < 0).slice(0, 3);
  const beste = [...rijen].filter((r) => r.zScore > 0).sort((a, b) => b.zScore - a.zScore).slice(0, 3);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: hex }} />
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
            Team-combinaties
          </p>
        </div>
        <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
          60d
        </span>
      </div>

      {beste.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <TrendingUp size={11} style={{ color: "var(--sf-accent, #00E5FF)" }} />
            <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--sf-accent, #00E5FF)" }}>
              Best presterend
            </p>
          </div>
          <div className="space-y-1.5">
            {beste.map((r) => <Rij key={`${r.aId}-${r.bId}`} r={r} hex="var(--sf-accent, #00E5FF)" />)}
          </div>
        </section>
      )}

      {slechtste.length > 0 && (
        <section>
          <div className="flex items-center gap-1 mb-2">
            <TrendingDown size={11} style={{ color: "var(--sf-danger, #FF3D5C)" }} />
            <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "var(--sf-danger, #FF3D5C)" }}>
              Onder gemiddeld
            </p>
          </div>
          <div className="space-y-1.5">
            {slechtste.map((r) => <Rij key={`${r.aId}-${r.bId}`} r={r} hex="var(--sf-danger, #FF3D5C)" />)}
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
            Tip: overweeg om deze duo's minder vaak samen in te roosteren — splitsen kan een nieuwe dynamiek geven.
          </p>
        </section>
      )}
    </div>
  );
}

function Rij({ r, hex }: { r: CombiRij; hex: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate" style={{ color: "var(--text)" }}>
          {r.aNaam} <span style={{ color: "var(--muted)" }}>+</span> {r.bNaam}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
            {r.shiftsSamen} shifts
          </span>
          {r.gemSterren !== null && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: "var(--muted)" }}>
              <Star size={9} /> {r.gemSterren.toFixed(1)} · {r.reviewsAantal}
            </span>
          )}
          <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
            €{Math.round(r.omzetPerUur)}/u
          </span>
        </div>
      </div>
      <div
        className="font-display text-[14px] font-semibold tabular-nums"
        style={{ color: hex }}
      >
        {r.zScore > 0 ? "+" : ""}{r.zScore.toFixed(1)}σ
      </div>
    </div>
  );
}
