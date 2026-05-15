"use client";

/**
 * Medewerker-leaderboard — top performers van een bedrijf over een
 * venster (default 30 dagen). Reviews-component telt klant-feedback van
 * dagen waarop de medewerker op rooster stond; omzet-component beloont
 * productieve uren. Beide 0-50, samen 0-100.
 */
import { useEffect, useState } from "react";
import { Trophy, Star, TrendingUp, Loader2, Clock, ChevronRight } from "lucide-react";
import type { ScoreRij } from "@/lib/medewerker-score";
import DetailSheet from "./sf/DetailSheet";

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
  const [geselecteerd, setGeselecteerd] = useState<ScoreRij | null>(null);

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
          <button
            type="button"
            key={r.medewerkerId}
            onClick={() => setGeselecteerd(r)}
            className="flex items-center gap-3 py-2 w-full text-left transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-lg"
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
            <ChevronRight size={14} style={{ color: "var(--muted)" }} className="shrink-0" />
          </button>
        ))}
      </div>

      {rijen.length > limit && (
        <p className="text-center font-mono text-[10px] mt-2" style={{ color: "var(--muted)" }}>
          + {rijen.length - limit} meer
        </p>
      )}

      <DetailSheet
        open={geselecteerd !== null}
        onClose={() => setGeselecteerd(null)}
        titel={geselecteerd ? `${geselecteerd.voornaam} ${geselecteerd.achternaam}` : ""}
        subtitel={geselecteerd ? `Rang #${geselecteerd.rang} · laatste ${venster} dagen` : ""}
        hex={hex}
      >
        {geselecteerd && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
              <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                Totaalscore
              </p>
              <div className="flex items-baseline gap-2">
                <p
                  className="font-display text-[36px] font-semibold tabular-nums leading-none"
                  style={{ color: hex, letterSpacing: "-0.018em" }}
                >
                  {Math.round(geselecteerd.totaalScore)}
                </p>
                <p className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>
                  / 100
                </p>
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--sf-hairline)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, geselecteerd.totaalScore)}%`,
                    background: hex,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Star size={11} style={{ color: hex }} />
                  <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                    Reviews-component
                  </p>
                </div>
                <p
                  className="font-display text-[22px] font-semibold tabular-nums leading-tight"
                  style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
                >
                  {Math.round(geselecteerd.reviewsBijdrage)}
                  <span className="font-mono text-[11px] font-normal" style={{ color: "var(--muted)" }}> /50</span>
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                  {geselecteerd.reviewsAantal} reviews · gem {geselecteerd.gemSterren?.toFixed(1) ?? "—"}★
                </p>
              </div>

              <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={11} style={{ color: hex }} />
                  <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                    Omzet-component
                  </p>
                </div>
                <p
                  className="font-display text-[22px] font-semibold tabular-nums leading-tight"
                  style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
                >
                  {Math.round(geselecteerd.omzetBijdrage)}
                  <span className="font-mono text-[11px] font-normal" style={{ color: "var(--muted)" }}> /50</span>
                </p>
                <p className="font-mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                  €{Math.round(geselecteerd.omzetPerUur)}/uur
                </p>
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={11} style={{ color: hex }} />
                <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                  Activiteit
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>Gewerkte uren</p>
                  <p className="font-display text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {Math.round(geselecteerd.gewerkteUren)}u
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>Review-punten</p>
                  <p className="font-display text-[18px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {Math.round(geselecteerd.reviewsPunten)}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Score = reviews-bijdrage (0–50) + omzet-bijdrage (0–50). Reviews tellen op
              shifts waarop deze medewerker stond ingeroosterd. Omzet/uur = totaal-omzet
              tijdens shifts ÷ gewerkte uren.
            </p>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
