"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

const BEDRIJVEN = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕", kleur: "#00B8FF" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢", kleur: "#00D27A" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟", kleur: "#FF8A00" },
] as const;

type Slug = "bb" | "sl" | "kl";

interface LiveData {
  omzetVandaag: number;
  aantalTransactiesVandaag: number;
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

// ─── Grap-generator ──────────────────────────────────────────────────────────

interface GrapSet { bb: string; sl: string; kl: string }

const GRAPPEN: Record<string, GrapSet[]> = {
  ochtend: [
    { bb: "Goedemorgen 👋", sl: "Ik ben er nog niet klaar voor", kl: "Koffie first" },
    { bb: "Wie is er al wakker?", sl: "Zzz...", kl: "Geef me 5 minuten" },
    { bb: "Teller staat nog op nul", sl: "Wij ook", kl: "Samen sterk" },
  ],
  bb_leidt: [
    { bb: "Weer gewoon die barista-magie ✨", sl: "Jij verkoopt koffie aan verslaafden", kl: "…geen comment" },
    { bb: "De teller loopt door hoor 😏", sl: "Mijn klanten zijn selectiever", kl: "Ik werk aan mijn kroket-empire" },
    { bb: "Kom op jongens, probeer het eens", sl: "Niet iedereen heeft verslaafde klanten", kl: "Wacht maar tot de lunch" },
    { bb: "Ik ga al een tijdje lekker 💅", sl: "Gefeliciteerd met je cafeïne-business", kl: "Ik ben gewoon traag op gang" },
  ],
  sl_leidt: [
    { bb: "Wauw, sate-dag vandaag?", sl: "Weten we al lang 🍢", kl: "Ik begrijp het niet, krokets zijn ook lekker" },
    { bb: "Dat komt door het weer vast", sl: "Nee, gewoon kwaliteit", kl: "Volgend uur boven jullie allebei" },
    { bb: "Saté loopt vandaag", sl: "Elke dag eigenlijk 😌", kl: "Ik ben ook goed hoor" },
  ],
  kl_leidt: [
    { bb: "Hoe?!", sl: "Wat?!", kl: "🥟🥟🥟 IK ZEID HET" },
    { bb: "Is dit een vergissing?", sl: "De kroket loket leidt? Echt??", kl: "Jullie kunnen wat van mij leren" },
    { bb: "Iemand uitleggen alsjeblieft", sl: "Geen idee wat er gaande is", kl: "Kroketten zijn de toekomst, altijd geweten" },
  ],
  gelijkspel: [
    { bb: "Eerlijk spel vandaag", sl: "Zo hoort het", kl: "Voor nu..." },
    { bb: "Jullie doen vandaag best je best", sl: "Dat zeg ik terug", kl: "Mooie middag dit" },
    { bb: "Niemand wint, niemand verliest", sl: "Dat is ook een uitkomst", kl: "Ik noem het: evenwicht" },
  ],
  bb_nul: [
    { bb: "De koffie moet nog zetten ☕", sl: "Brunch & Slapen bedoel je?", kl: "Haha eindelijk!" },
    { bb: "Wij zijn meer van de late start", sl: "Dat geloof ik ja", kl: "Geen klanten of geen zin?" },
  ],
  sl_nul: [
    { bb: "Saté op vakantie vandaag?", sl: "De oven staat op te warmen", kl: "We wachten op je SL 🍢" },
    { bb: "Heeft SL al opengedaan?", sl: "Wij beginnen later, dat is het", kl: "Straks inhalen toch?" },
  ],
  kl_nul: [
    { bb: "Heeft KL al iemand gezien?", sl: "Ssht, laat ze slapen", kl: "Ik wacht op de juiste klant" },
    { bb: "Kroket-stand gesloten geloof ik", sl: "Of ze tellen de munten nog", kl: "Kwaliteit boven kwantiteit" },
    { bb: "KL staat er al wel hè?", sl: "Ja maar niemand wil", kl: "Ze komen wel... 🥟" },
  ],
};

function bepaalScenario(bb: number, sl: number, kl: number): string {
  if (bb === 0 && sl === 0 && kl === 0) return "ochtend";
  if (bb === 0) return "bb_nul";
  if (sl === 0) return "sl_nul";
  if (kl === 0) return "kl_nul";
  const max = Math.max(bb, sl, kl);
  const min = Math.min(bb, sl, kl);
  if (max / Math.max(min, 1) > 2.5) {
    if (bb === max) return "bb_leidt";
    if (sl === max) return "sl_leidt";
    return "kl_leidt";
  }
  return "gelijkspel";
}

// ─── Papegaai component ───────────────────────────────────────────────────────

function Papegaai({
  kleur,
  delay,
  tekst,
  actief,
}: {
  kleur: string;
  delay: number;
  tekst: string;
  actief: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Speech bubble */}
      <div
        className="absolute bottom-full mb-1 px-2 py-1 rounded-lg text-[9px] font-semibold text-white whitespace-nowrap max-w-[120px] text-center leading-tight transition-all duration-500"
        style={{
          background: kleur + "dd",
          opacity: actief ? 1 : 0,
          transform: actief ? "translateY(0) scale(1)" : "translateY(4px) scale(0.9)",
          pointerEvents: "none",
          boxShadow: actief ? `0 0 8px ${kleur}88` : "none",
          // Pijltje onderaan
          filter: actief ? `drop-shadow(0 2px 4px ${kleur}66)` : "none",
        }}
      >
        {tekst}
        {/* Pijltje */}
        <span
          className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: `5px solid ${kleur}dd`,
          }}
        />
      </div>

      {/* Papegaai emoji met neon glow + bounce */}
      <span
        className="text-base select-none cursor-default"
        style={{
          filter: `drop-shadow(0 0 6px ${kleur}) drop-shadow(0 0 12px ${kleur}88)`,
          animation: `parrotBob 0.5s ease-in-out infinite`,
          animationDelay: `${delay}ms`,
          display: "inline-block",
        }}
      >
        🦜
      </span>
    </div>
  );
}

// ─── BedrijfKolom ─────────────────────────────────────────────────────────────

function BedrijfKolom({
  slug, naam, emoji, kleur, onOmzetUpdate,
}: {
  slug: Slug; naam: string; emoji: string; kleur: string;
  onOmzetUpdate: (slug: Slug, omzet: number) => void;
}) {
  const [data, setData]         = useState<LiveData | null>(null);
  const [verwacht, setVerwacht] = useState<VerwachtData | null>(null);
  const [nu, setNu]             = useState(new Date());

  const laadLive = useCallback(async () => {
    try {
      const res  = await fetch(`/api/sumup/${slug}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
      onOmzetUpdate(slug, json.omzetVandaag ?? 0);
    } catch { /* stil */ }
  }, [slug, onOmzetUpdate]);

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
  const klanten  = data?.aantalTransactiesVandaag ?? null;
  const heeftSchema = verwacht !== null && (verwacht.verwachtVandaag > 0 || verwacht.weekdagCurve.some(v => v > 0));
  const voorOp   = omzet >= verwachtNu;
  const verschil = Math.abs(omzet - verwachtNu);

  return (
    <div
      className="flex-1 px-3 sm:px-4 py-2 border-r last:border-r-0"
      style={{ borderColor: "#1e2530" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm leading-none">{emoji}</span>
        <span
          className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] font-mono truncate"
          style={{ color: kleur }}
        >
          {naam}
        </span>
      </div>
      <p
        className="text-sm sm:text-base font-bold font-mono tabular-nums leading-tight"
        style={{ color: "#e2e8f0" }}
      >
        {data ? fmt(omzet) : "€–"}
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-0.5 gap-0.5">
        {heeftSchema ? (
          <span
            className="text-[9px] sm:text-[10px] font-mono font-semibold"
            style={{ color: voorOp ? "#4ade80" : "#f87171" }}
          >
            {voorOp ? "✓" : "✗"} {voorOp ? "+" : "-"}{fmt(verschil)}
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#475569" }}>
            schema laadt…
          </span>
        )}
        {klanten !== null && (
          <span className="text-[9px] sm:text-[10px] font-mono" style={{ color: "#64748b" }}>
            {klanten} klanten
          </span>
        )}
      </div>
    </div>
  );
}

// ─── LiveBalk (root) ──────────────────────────────────────────────────────────

export default function LiveBalk() {
  const [omzetten, setOmzetten] = useState<Record<Slug, number>>({ bb: 0, sl: 0, kl: 0 });
  const [actiefIdx, setActiefIdx] = useState(0);   // 0=bb 1=sl 2=kl
  const [jokeIdx, setJokeIdx]     = useState(0);
  const jokeIdxRef = useRef(0);

  const updateOmzet = useCallback((slug: Slug, omzet: number) => {
    setOmzetten(prev => ({ ...prev, [slug]: omzet }));
  }, []);

  // Roteer: elke 3s volgende papegaai, elke 9s nieuwe grappenset
  useEffect(() => {
    const t = setInterval(() => {
      setActiefIdx(prev => {
        const next = (prev + 1) % 3;
        if (next === 0) {
          jokeIdxRef.current += 1;
          setJokeIdx(jokeIdxRef.current);
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Kies grappen op basis van huidige omzetten
  const grappen = useMemo(() => {
    const scenario = bepaalScenario(omzetten.bb, omzetten.sl, omzetten.kl);
    const sets     = GRAPPEN[scenario] ?? GRAPPEN.ochtend;
    return sets[jokeIdx % sets.length];
  }, [omzetten, jokeIdx]);

  const TEKSTEN: Record<Slug, string> = {
    bb: grappen.bb,
    sl: grappen.sl,
    kl: grappen.kl,
  };

  const DELAYS = [0, 150, 300];

  return (
    <>
      {/* CSS animatie injectie */}
      <style>{`
        @keyframes parrotBob {
          0%   { transform: translateY(0px)  rotate(0deg)   scaleX(1); }
          20%  { transform: translateY(-3px) rotate(-8deg)  scaleX(0.92); }
          40%  { transform: translateY(-1px) rotate(0deg)   scaleX(1); }
          60%  { transform: translateY(-3px) rotate(8deg)   scaleX(1.08); }
          80%  { transform: translateY(-1px) rotate(0deg)   scaleX(1); }
          100% { transform: translateY(0px)  rotate(0deg)   scaleX(1); }
        }
      `}</style>

      <div
        className="w-full sticky top-0 z-50"
        style={{ background: "#0a0e14", borderBottom: "1px solid #1e2530" }}
      >
        {/* Papegaaienrij */}
        <div className="flex" style={{ borderBottom: "1px solid #1a2030" }}>
          {BEDRIJVEN.map((b, i) => (
            <div
              key={b.slug}
              className="flex-1 flex justify-center items-end pb-0.5 pt-1.5 border-r last:border-r-0"
              style={{ borderColor: "#1e2530" }}
            >
              <Papegaai
                kleur={b.kleur}
                delay={DELAYS[i]}
                tekst={TEKSTEN[b.slug]}
                actief={actiefIdx === i}
              />
            </div>
          ))}
        </div>

        {/* Datakolommen */}
        <div className="flex">
          {BEDRIJVEN.map((b) => (
            <BedrijfKolom
              key={b.slug}
              {...b}
              onOmzetUpdate={updateOmzet}
            />
          ))}
        </div>
      </div>
    </>
  );
}
