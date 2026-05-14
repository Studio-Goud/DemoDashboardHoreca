"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRol } from "@/lib/useRol";
import AnimatedAmount from "@/components/AnimatedAmount";

const BEDRIJVEN = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕", kleur: "#0A84FF" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢", kleur: "#30B26F" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟", kleur: "#E07A1F" },
] as const;

type Slug = "bb" | "sl" | "kl";

interface UurRij { slot: number; label: string; omzet: number; txs: number; }
interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
  uurVerdeling?: UurRij[];
}
interface VerwachtData {
  verwachtVandaag: number;
  weekdagCurve: number[];
}

function verwachtTotNu(curve: number[]): number {
  if (!curve || curve.length !== 24) return 0;
  const nl = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const uur = nl.getHours();
  const min = nl.getMinutes() / 60;
  let som = 0;
  for (let i = 0; i < uur; i++) som += curve[i] ?? 0;
  som += (curve[uur] ?? 0) * min;
  return Math.round(som * 100) / 100;
}

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKort(n: number): string {
  return "€" + Math.round(n).toLocaleString("nl-NL");
}

interface InsightInput {
  bb: { omzet: number; klanten: number; verwachtNu: number };
  sl: { omzet: number; klanten: number; verwachtNu: number };
  kl: { omzet: number; klanten: number; verwachtNu: number };
}

/**
 * Eén item in de live-pulse ticker. `bedrijfIdx` bepaalt welke orb pulseert
 * (0 = BB, 1 = SL, 2 = KL, null = neutraal / alle 3).
 */
interface Insight {
  bedrijfIdx: 0 | 1 | 2 | null;
  tekst: string;
  /** Sorteer-prioriteit voor scenario-aware rotatie. Hoger = vaker. */
  prioriteit?: number;
}

/**
 * Genereer data-driven insights uit de live staten. Functioneert ALS de
 * grap-laag: in plaats van ironische one-liners zien we per ~5s een nieuw
 * informatief feitje. Insights waarvan de input nog niet beschikbaar is
 * worden weggefilterd (verwacht-data nog laden, etc.).
 */
function maakInsights(staten: InsightInput): Insight[] {
  const arr = [
    { idx: 0 as const, naam: "Brunch & Brew",   emoji: "☕", ...staten.bb },
    { idx: 1 as const, naam: "Saté Lounge",     emoji: "🍢", ...staten.sl },
    { idx: 2 as const, naam: "Het Kroket Loket", emoji: "🥟", ...staten.kl },
  ];
  const gesorteerd  = [...arr].sort((a, b) => b.omzet - a.omzet);
  const totOmzet    = arr.reduce((s, x) => s + x.omzet, 0);
  const totKlanten  = arr.reduce((s, x) => s + x.klanten, 0);
  const totVerwacht = arr.reduce((s, x) => s + x.verwachtNu, 0);
  const top         = gesorteerd[0];
  const gemBon      = totKlanten > 0 ? totOmzet / totKlanten : 0;

  // Tempo: euro per uur sinds opening — ruwe schatting via NL-tijd
  const nl = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const urenSindsOpening = Math.max(0.5, nl.getHours() + nl.getMinutes() / 60 - 9);
  const tempo = urenSindsOpening > 0 ? totOmzet / urenSindsOpening : 0;

  const items: Insight[] = [];

  if (totOmzet > 0) {
    items.push({
      bedrijfIdx: top.idx,
      tekst: `● LIVE · ${top.emoji} ${top.naam} leidt met ${fmtKort(top.omzet)}`,
      prioriteit: 2,
    });
    items.push({
      bedrijfIdx: null,
      tekst: `Σ Samen ${fmtKort(totOmzet)} over drie tellers`,
    });
  }

  if (totKlanten > 0) {
    items.push({
      bedrijfIdx: null,
      tekst: `⋅ ${totKlanten.toLocaleString("nl-NL")} klanten gepasseerd · gem. bon ${fmt(gemBon).replace(" ", " ")}`,
    });
  }

  if (totVerwacht > 0) {
    const pct      = Math.round((totOmzet / totVerwacht) * 100);
    const verschil = totOmzet - totVerwacht;
    const teken    = verschil >= 0 ? "+" : "−";
    items.push({
      bedrijfIdx: null,
      tekst: `▲ ${pct}% van schema · ${teken}${fmtKort(Math.abs(verschil))} t.o.v. verwacht`,
      prioriteit: 2,
    });
  }

  // Per-vestiging schema-deltas: alleen voor bedrijven waar verwacht-data binnen is.
  for (const b of arr) {
    if (b.verwachtNu <= 0) continue;
    const delta = b.omzet - b.verwachtNu;
    const teken = delta >= 0 ? "+" : "−";
    const status = Math.abs(delta) < 5 ? "op schema" : delta >= 0 ? "voorsprong" : "achterstand";
    items.push({
      bedrijfIdx: b.idx,
      tekst: `${b.emoji} ${b.naam}: ${teken}${fmtKort(Math.abs(delta))} ${status}`,
    });
  }

  if (tempo > 0 && urenSindsOpening >= 1) {
    items.push({
      bedrijfIdx: null,
      tekst: `↯ Tempo ${fmtKort(tempo)}/u · prognose eind van dag ~${fmtKort(tempo * 11)}`,
      prioriteit: 1,
    });
  }

  // Geen data nog? Tonen we een rustige boot-state — voorkomt lege ticker.
  if (items.length === 0) {
    items.push({ bedrijfIdx: null, tekst: "● LIVE · data laden…" });
  }

  return items;
}


// ─── BedrijfKolom ─────────────────────────────────────────────────────────────

interface BedrijfStaat { omzet: number; klanten: number; verwachtNu: number }

function BedrijfKolom({
  slug, naam, emoji, kleur, onUpdate, isActief,
}: {
  slug: Slug; naam: string; emoji: string; kleur: string;
  onUpdate: (slug: Slug, staat: BedrijfStaat) => void;
  isActief?: boolean;
}) {
  const [data, setData]         = useState<LiveData | null>(null);
  const [verwacht, setVerwacht] = useState<VerwachtData | null>(null);
  const [nu, setNu]             = useState(new Date());

  const laadLive = useCallback(async () => {
    try {
      const res  = await fetch(`/api/sumup/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch { /* stil */ }
  }, [slug]);

  const laadVerwacht = useCallback(async () => {
    try {
      const res  = await fetch(`/api/verwacht/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setVerwacht(json);
    } catch { /* stil */ }
  }, [slug]);

  useEffect(() => {
    laadLive();
    laadVerwacht();
    const tLive     = setInterval(laadLive,        20_000);
    const tVerwacht = setInterval(laadVerwacht, 5 * 60_000);
    const tKlok     = setInterval(() => setNu(new Date()), 60_000);
    window.addEventListener("dashboard:refresh", laadLive);
    return () => {
      clearInterval(tLive); clearInterval(tVerwacht); clearInterval(tKlok);
      window.removeEventListener("dashboard:refresh", laadLive);
    };
  }, [laadLive, laadVerwacht]);

  const verwachtNu = useMemo(
    () => verwacht ? verwachtTotNu(verwacht.weekdagCurve) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verwacht, nu]
  );

  const omzet    = data?.omzetVandaag ?? 0;
  const klanten  = data?.aantalTransactiesVandaag ?? 0;
  const heeftKlanten = data?.aantalTransactiesVandaag !== undefined && data?.aantalTransactiesVandaag !== null;
  const heeftSchema = verwacht !== null && (verwacht.verwachtVandaag > 0 || verwacht.weekdagCurve.some(v => v > 0));
  const voorOp   = omzet >= verwachtNu;
  const verschil = Math.abs(omzet - verwachtNu);

  // Doorlussen naar parent voor o.a. highlights-berekening
  useEffect(() => {
    onUpdate(slug, { omzet, klanten, verwachtNu });
  }, [slug, omzet, klanten, verwachtNu, onUpdate]);

  // Sparkline-data: cumulatieve uurcurve t/m nu (zelfde stijl als Apple Stocks)
  const sparkPoints = (() => {
    const uren = data?.uurVerdeling;
    if (!uren || uren.length === 0) return [] as { x: number; y: number }[];
    let cum = 0;
    const punten: { x: number; y: number }[] = [];
    const huidigUur = new Date().getHours();
    for (let i = 0; i <= Math.min(huidigUur, 23); i++) {
      cum += uren[i]?.omzet ?? 0;
      punten.push({ x: i, y: cum });
    }
    return punten;
  })();
  const max = sparkPoints.length > 0 ? Math.max(...sparkPoints.map((p) => p.y), 1) : 1;
  const sparkPath = sparkPoints
    .map((p, i) => {
      const x = (p.x / 23) * 100;
      const y = 100 - (p.y / max) * 100;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const sparkFill = sparkPath
    ? `${sparkPath} L 100 100 L 0 100 Z`
    : "";

  return (
    <div
      className="relative px-3 sm:px-4 py-2.5 overflow-hidden transition-colors"
      style={{
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: isActief ? `${kleur}0F` : "transparent",
      }}
    >
      {/* Sparkline-achtergrond */}
      {sparkPath && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.6 }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`spark-${slug}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={kleur} stopOpacity={0.32} />
              <stop offset="100%" stopColor={kleur} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={sparkFill} fill={`url(#spark-${slug})`} />
          <path
            d={sparkPath}
            fill="none"
            stroke={kleur}
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: kleur,
              boxShadow: isActief ? `0 0 6px ${kleur}` : "none",
              opacity: isActief ? 1 : 0.6,
            }}
          />
          <span
            className="text-[10px] sm:text-[11px] font-semibold tracking-tight truncate"
            style={{ color: "#e5e7eb", opacity: isActief ? 1 : 0.75, letterSpacing: "-0.005em" }}
          >
            {naam}
          </span>
        </div>

        <p
          className="text-[15px] sm:text-[17px] font-semibold tabular-nums leading-tight"
          style={{ color: "#f5f5f7", letterSpacing: "-0.014em" }}
        >
          {data ? <AnimatedAmount value={omzet} format={fmt} duurMs={650} /> : "€–"}
        </p>

        <div className="flex items-center gap-2 mt-0.5">
          {heeftSchema ? (
            <span
              className="text-[10px] tabular-nums font-medium"
              style={{ color: voorOp ? "#34D399" : "#FB923C" }}
            >
              {voorOp ? "+" : "−"}
              <AnimatedAmount
                value={verschil}
                format={(n) => fmt(n).replace("€", "€ ")}
                duurMs={650}
              />
            </span>
          ) : (
            <span className="text-[10px]" style={{ color: "#64748b" }}>
              schema laadt…
            </span>
          )}
          {heeftKlanten && (
            <span className="text-[10px] tabular-nums" style={{ color: "#94a3b8" }}>
              {klanten} klanten
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LiveBalk (root) ──────────────────────────────────────────────────────────

export default function LiveBalk() {
  const pathname   = usePathname();
  const { rol }    = useRol();
  const LEEG_STAAT: BedrijfStaat = { omzet: 0, klanten: 0, verwachtNu: 0 };
  const [staten, setStaten] = useState<Record<Slug, BedrijfStaat>>({
    bb: LEEG_STAAT, sl: LEEG_STAAT, kl: LEEG_STAAT,
  });
  const omzetten = useMemo(
    () => ({ bb: staten.bb.omzet, sl: staten.sl.omzet, kl: staten.kl.omzet }),
    [staten]
  );
  // Live-pulse ticker: rotateert door data-driven insights. Vervangt het
  // oude grap-systeem. Elke ~5,5s een nieuwe insight; de orb van het
  // bijbehorende bedrijf pulseert mee (of geen als de insight neutraal is).
  const [insightIdx, setInsightIdx] = useState(0);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statenRef = useRef(staten);
  statenRef.current = staten;

  const updateBedrijf = useCallback((slug: Slug, staat: BedrijfStaat) => {
    setStaten(prev => {
      const huidig = prev[slug];
      if (
        huidig.omzet === staat.omzet &&
        huidig.klanten === staat.klanten &&
        huidig.verwachtNu === staat.verwachtNu
      ) {
        return prev;
      }
      return { ...prev, [slug]: staat };
    });
  }, []);

  const insights = useMemo(() => maakInsights(staten), [staten]);
  // Wrap-around index in geval het aantal insights ineens kleiner wordt.
  const huidigeInsight: Insight = insights[insightIdx % Math.max(1, insights.length)] ?? insights[0];

  useEffect(() => {
    function planNext() {
      if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
      tickerTimerRef.current = setTimeout(() => {
        setInsightIdx((i) => i + 1);
        planNext();
      }, 5500);
    }
    planNext();
    return () => {
      if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
    };
  }, []);

  // Welkomst via papegaai ipv WelkomBanner
  const [welkomOverride, setWelkomOverride] = useState<{ idx: number; tekst: string } | null>(null);
  const welkomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const WELKOM_PAPEGAAI: Record<string, { idx: number; tekst: string }> = {
    Ricardo: { idx: 0, tekst: "Welkom Ricardo! ☕ Goeie dag gewenst 💙" },
    Matthieu: { idx: 2, tekst: "Welkom Matthieu! 🥟 Klaar voor de dag? 🧡" },
  };

  useEffect(() => {
    function toonWelkom(naam: string) {
      const config = WELKOM_PAPEGAAI[naam];
      if (!config) return;
      setWelkomOverride(config);
      if (welkomTimerRef.current) clearTimeout(welkomTimerRef.current);
      welkomTimerRef.current = setTimeout(() => {
        setWelkomOverride(null);
      }, 5000);
    }
    const pending = sessionStorage.getItem("sg_welkom_pending");
    if (pending) {
      sessionStorage.removeItem("sg_welkom_pending");
      toonWelkom(pending);
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ naam: string }>).detail;
      if (detail?.naam) {
        sessionStorage.removeItem("sg_welkom_pending");
        toonWelkom(detail.naam);
      }
    };
    window.addEventListener("sg:welkom", handler);
    return () => {
      window.removeEventListener("sg:welkom", handler);
      if (welkomTimerRef.current) clearTimeout(welkomTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className="w-full sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Datakolommen — klikbaar als navigatie. De onderbalk pulseert
            wanneer de huidige insight die specifieke vestiging betreft
            (welkom-override heeft voorrang). */}
        <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {BEDRIJVEN.map((b, i) => {
            const isActief    = pathname === `/${b.slug}`;
            const welkomHere  = welkomOverride?.idx === i;
            const insightHere = !welkomOverride && huidigeInsight?.bedrijfIdx === i;
            const pulseAan    = welkomHere || insightHere;
            const borderKleur = isActief ? b.kleur : "transparent";
            return (
              <Link
                key={b.slug}
                href={`/${b.slug}`}
                className={`flex-1 block relative ${pulseAan ? "kolom-pulse" : ""}`}
                style={{
                  borderBottom: `2px solid ${borderKleur}`,
                  // CSS variable zodat de @keyframes de juiste vestiging-kleur gebruikt
                  ["--puls-kleur" as string]: b.kleur,
                }}
              >
                <BedrijfKolom
                  {...b}
                  onUpdate={updateBedrijf}
                  isActief={isActief}
                />
              </Link>
            );
          })}
        </div>

        {/* Spreker-laag — verberg voor managers (geen humor, alleen data).
            Volledig BINNEN de balk-container met overflow-hidden zodat
            niets uitsteekt richting de DashboardNav-tabs eronder.
            pointer-events: none want er valt niets te klikken. */}
        {rol !== "manager" && (
          <div style={{ pointerEvents: "none" }}>
            {/* Live-pulse ticker — data-driven insight rotateert elke ~5,5s.
                De gekleurde onderbalk van de bijbehorende vestiging pulseert
                mee (zie .kolom-pulse). Welkom-override krijgt voorrang.
                Vaste hoogte zodat de balk niet "ademt"; truncate met ellipsis
                voor te lange tekst. */}
            <div
              className="px-4 py-2.5 h-[34px] flex items-center justify-center overflow-hidden"
              aria-hidden="true"
            >
              {(() => {
                if (welkomOverride) {
                  const b = BEDRIJVEN[welkomOverride.idx];
                  return (
                    <p
                      key={`welkom-${welkomOverride.tekst}`}
                      className="text-[11px] font-medium text-center truncate w-full transition-opacity duration-500 fade-up"
                      style={{ color: b.kleur, opacity: 0.92 }}
                    >
                      {welkomOverride.tekst}
                    </p>
                  );
                }
                if (!huidigeInsight) return null;
                // Kleur: vestiging-specifiek als bedrijfIdx gezet, anders neutraal slate.
                const kleur = huidigeInsight.bedrijfIdx !== null
                  ? BEDRIJVEN[huidigeInsight.bedrijfIdx].kleur
                  : "#94a3b8";
                return (
                  <p
                    key={`ins-${insightIdx}-${huidigeInsight.tekst}`}
                    className="text-[11px] font-medium tabular-nums text-center truncate w-full transition-opacity duration-500 fade-up tracking-wide"
                    style={{ color: kleur, opacity: 0.92, letterSpacing: "0.01em" }}
                  >
                    {huidigeInsight.tekst}
                  </p>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
