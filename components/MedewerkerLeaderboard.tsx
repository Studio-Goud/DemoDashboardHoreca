"use client";

/**
 * Medewerker-leaderboard — top performers van een bedrijf over een
 * venster (default 30 dagen). Reviews-component telt klant-feedback van
 * dagen waarop de medewerker op rooster stond; omzet-component beloont
 * productieve uren. Beide 0-50, samen 0-100.
 */
import { useEffect, useState } from "react";
import { Trophy, Star, TrendingUp, Loader2 } from "lucide-react";
import type { ScoreRij } from "@/lib/medewerker-score";

interface Props {
  bedrijfSlug: string;
  hex: string;
  /** Aantal dagen terug. Default 30. */
  venster?: number;
  /** Max rijen om te tonen. Default 5. */
  limit?: number;
}

export default function MedewerkerLeaderboard({ bedrijfSlug, hex, venster = 30, limit = 5 }: Props) {
  const [rijen, setRijen] = useState<ScoreRij[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    let actief = true;
    fetch(`/api/leaderboard/medewerker/${bedrijfSlug}?venster=${venster}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("kon leaderboard niet laden");
        return r.json();
      })
      .then((d) => { if (actief) setRijen(d.rijen ?? []); })
      .catch((e) => { if (actief) setFout(e.message); });
    return () => { actief = false; };
  }, [bedrijfSlug, venster]);

  if (fout) {
    return (
      <div className="card">
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>{fout}</p>
      </div>
    );
  }
  if (rijen === null) {
    return (
      <div className="card flex items-center gap-2 justify-center py-6">
        <Loader2 size={14} className="animate-spin" style={{ color: hex }} />
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>Score berekenen…</span>
      </div>
    );
  }
  if (rijen.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={14} style={{ color: hex }} />
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
            Personeel-leaderboard
          </p>
        </div>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Nog geen data. Hang een QR-code op tafel + zorg dat er rooster-data is.
        </p>
      </div>
    );
  }

  const zichtbaar = rijen.slice(0, limit);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} style={{ color: hex }} />
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
            Personeel-leaderboard
          </p>
        </div>
        <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>
          {venster}d
        </span>
      </div>

      <div className="space-y-2">
        {zichtbaar.map((r) => (
          <div
            key={r.medewerkerId}
            className="flex items-center gap-3 py-2"
            style={{ borderBottom: "1px solid var(--card-border, rgba(255,255,255,0.06))" }}
          >
            <div
              className="font-display text-[14px] font-semibold tabular-nums w-6 text-center"
              style={{ color: r.rang === 1 ? hex : "var(--muted)" }}
            >
              {r.rang}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium truncate" style={{ color: "var(--text)" }}>
                {r.voornaam} {r.achternaam}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {r.reviewsAantal > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                    <Star size={10} />
                    {r.gemSterren?.toFixed(1)} · {r.reviewsAantal}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: "var(--muted)" }}>
                  <TrendingUp size={10} />
                  €{Math.round(r.omzetPerUur)}/u
                </span>
              </div>
            </div>
            <div
              className="font-display text-[18px] font-semibold tabular-nums"
              style={{ color: hex, letterSpacing: "-0.018em" }}
            >
              {Math.round(r.totaalScore)}
            </div>
          </div>
        ))}
      </div>

      {rijen.length > limit && (
        <p className="text-center font-mono text-[10px] mt-2" style={{ color: "var(--muted)" }}>
          + {rijen.length - limit} meer
        </p>
      )}
    </div>
  );
}
