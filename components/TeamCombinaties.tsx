"use client";

/**
 * Team-combinaties widget — toont top 3 + onder-3 paren over een venster.
 * Owner gebruikt dit signaal om te beslissen welke duo's vaker / minder
 * vaak ingeroosterd moeten worden. Het rooster wordt hier NIET automatisch
 * op aangepast — dat is bewust een handmatige beslissing (Phase A).
 */
import { useEffect, useState } from "react";
import { Users, TrendingUp, TrendingDown, Star, Loader2, ChevronRight } from "lucide-react";
import type { CombiRij } from "@/lib/team-combinaties";
import DetailSheet from "./sf/DetailSheet";

interface Props {
  bedrijfSlug: string;
  hex: string;
}

export default function TeamCombinaties({ bedrijfSlug, hex }: Props) {
  const [rijen, setRijen] = useState<CombiRij[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [actief, setActief] = useState<{ rij: CombiRij; kleur: string } | null>(null);

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
            {beste.map((r) => (
              <Rij
                key={`${r.aId}-${r.bId}`}
                r={r}
                hex="var(--sf-accent, #00E5FF)"
                onClick={() => setActief({ rij: r, kleur: "var(--sf-accent, #00E5FF)" })}
              />
            ))}
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
            {slechtste.map((r) => (
              <Rij
                key={`${r.aId}-${r.bId}`}
                r={r}
                hex="var(--sf-danger, #FF3D5C)"
                onClick={() => setActief({ rij: r, kleur: "var(--sf-danger, #FF3D5C)" })}
              />
            ))}
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
            Tip: overweeg om deze duo's minder vaak samen in te roosteren — splitsen kan een nieuwe dynamiek geven.
          </p>
        </section>
      )}

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief ? `${actief.rij.aNaam} + ${actief.rij.bNaam}` : ""}
        subtitel={actief ? `${actief.rij.shiftsSamen} gezamenlijke shifts · laatste 60 dagen` : ""}
        hex={actief?.kleur ?? hex}
      >
        {actief && <CombiDetail rij={actief.rij} kleur={actief.kleur} />}
      </DetailSheet>
    </div>
  );
}

function Rij({ r, hex, onClick }: { r: CombiRij; hex: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 py-1.5 w-full text-left hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg cursor-pointer"
    >
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
      <ChevronRight size={12} className="shrink-0 opacity-40" />
    </button>
  );
}

function CombiDetail({ rij, kleur }: { rij: CombiRij; kleur: string }) {
  const isOndergemiddeld = rij.zScore < 0;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: `${kleur === "var(--sf-danger, #FF3D5C)" ? "rgba(255,61,92,0.1)" : "rgba(0,229,255,0.1)"}`, border: `1px solid ${kleur}40` }}>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: kleur }}>
          Performance vs team-gemiddelde
        </p>
        <p
          className="font-display text-[36px] font-semibold tabular-nums leading-none"
          style={{ color: kleur, letterSpacing: "-0.018em" }}
        >
          {rij.zScore > 0 ? "+" : ""}{rij.zScore.toFixed(2)}σ
        </p>
        <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          Z-score: hoe veel standaarddeviaties dit duo afwijkt van het bedrijfsgemiddelde
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Star size={11} style={{ color: kleur }} />
            <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Reviews
            </p>
          </div>
          <p className="font-display text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            {rij.reviewsAantal}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            gemiddeld {rij.gemSterren?.toFixed(1) ?? "—"}★
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={11} style={{ color: kleur }} />
            <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Omzet/uur
            </p>
          </div>
          <p className="font-display text-[22px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
            €{Math.round(rij.omzetPerUur)}
          </p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            tijdens shared shifts
          </p>
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Users size={11} style={{ color: kleur }} />
          <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
            Samen gewerkt
          </p>
        </div>
        <p className="text-[13px]" style={{ color: "var(--text)" }}>
          <strong>{rij.shiftsSamen} shifts</strong> in de laatste 60 dagen.
        </p>
      </div>

      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        {isOndergemiddeld
          ? "Dit duo scoort onder het team-gemiddelde. Mogelijke oorzaken: verschillende werkstijlen, gebrek aan synergie, of toeval (60 dagen kan te kort zijn). Overweeg om ze minder vaak samen in te roosteren of geef de combinatie meer tijd."
          : "Dit duo presteert boven gemiddeld — ze versterken elkaar duidelijk. Roostere ze regelmatig samen op drukke dagen voor maximaal effect."}
      </p>
    </div>
  );
}
