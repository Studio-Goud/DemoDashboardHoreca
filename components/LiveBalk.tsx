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
    { bb: "Goedemorgen Rotterdam 👋", sl: "Ik ben er nog niet klaar voor", kl: "Koffie first" },
    { bb: "Wie is er al wakker?", sl: "Zzz... de Maas ook nog niet", kl: "Geef me 5 minuten" },
    { bb: "Teller staat op nul", sl: "Wij ook. Nul", kl: "Samen sterk 💪" },
    { bb: "Nieuwe dag, nieuwe kansen", sl: "Eerst zien dan geloven", kl: "Wacht maar af" },
    { bb: "De espresso staat klaar", sl: "Wij ook bijna", kl: "Iemand de deur open?" },
    { bb: "Rotterdam wacht op ons", sl: "Rotterdam wacht op niemand", kl: "Dat klopt eigenlijk" },
    { bb: "Ochtendploeg aanwezig", sl: "Aanwezig maar suf", kl: "Zelfde" },
    { bb: "Dag begint zo", sl: "Dag begint zo ja", kl: "Doe maar gewoon" },
    { bb: "Hoelaat is het eigenlijk", sl: "Te vroeg", kl: "Veel te vroeg" },
    { bb: "Niet lullen maar zetten", sl: "Die koffie of die saté?", kl: "Beiden" },
    { bb: "Markthal ook nog dicht", sl: "Wij zijn avontuurlijker", kl: "Of dommer" },
    { bb: "Erasmusbrug staat er al", sl: "Die werkt tenminste al", kl: "Hij klopt ook" },
  ],
  bb_leidt: [
    { bb: "Niet lullen maar poetsen 😤", sl: "Jij verkoopt koffie aan verslaafden", kl: "Geen comment" },
    { bb: "Nie lullen maar poetsen — en tellen", sl: "Mijn klanten zijn selectiever", kl: "Ik werk aan mijn kroket-empire" },
    { bb: "De Kuip loopt ook niet leeg hoor", sl: "Die vergelijking gaat niet op", kl: "Wacht maar tot de lunch" },
    { bb: "Ik ga al een tijdje lekker 💅", sl: "Gefeliciteerd met je cafeïne-business", kl: "Ik ben gewoon traag op gang" },
    { bb: "Rotterdam aan de koffie vandaag", sl: "Rotterdam is altijd al verslaafd", kl: "Dat wisten we al" },
    { bb: "Markthal kan wat van ons leren", sl: "Die heeft geen keuken meer nodig", kl: "Ik ook bijna niet" },
    { bb: "De teller loopt door hoor 😏", sl: "Dat zie ik ja. Zucht.", kl: "Straks inhalen" },
    { bb: "Feyenoord wint ook altijd uiteindelijk", sl: "Dat is een andere sport", kl: "En een andere uitslag" },
    { bb: "Wij zijn de Coolsingel van de horeca", sl: "Lekker breed en leeg?", kl: "Hahaha goeie" },
    { bb: "Zo zie je maar. Koffie regeert", sl: "In Den Haag drinken ze thee", kl: "En terecht dat ze verloren" },
    { bb: "Kom op dan, bij ons kan iedereen terecht", sl: "Behalve mensen zonder geld", kl: "En Ajax-supporters" },
    { bb: "Wij zijn gewoon op dreef 🚀", sl: "Ja ja, geniet er maar van", kl: "Volgende week anders" },
    { bb: "Dit voelt als een Champions League avond", sl: "Vergeet het — jij bent PSV max", kl: "Ik ben NAC" },
  ],
  sl_leidt: [
    { bb: "Sate-dag vandaag blijkbaar?", sl: "Elke dag is sate-dag 🍢", kl: "Ik begrijp er niks van" },
    { bb: "Dat komt door het weer vast", sl: "Nee, gewoon kwaliteit", kl: "Volgend uur boven jullie allebei" },
    { bb: "Saté loopt hard vandaag", sl: "Altijd al hard gelopen 😌", kl: "Ik ook maar dan langzamer" },
    { bb: "Wauw, gaan ze lekker", sl: "Rotterdam houdt van sate", kl: "Rotterdam houdt ook van kroket hoor" },
    { bb: "Hoe doen ze dat toch", sl: "Goed eten maken helpt", kl: "Dat doe ik ook!" },
    { bb: "Ik ga ook sate eten straks", sl: "Verstandige keuze", kl: "Verraad" },
    { bb: "SL knalt er doorheen", sl: "Stokje erin, sate d'rop, klaar", kl: "Als het maar zo makkelijk was" },
    { bb: "Dit had ik verwacht eigenlijk", sl: "Dat we winnen? Ja logisch", kl: "Ik ook eigenlijk" },
    { bb: "Katendrecht-energie vandaag bij SL", sl: "Altijd Katendrecht-energie", kl: "Ik zit meer op Spijkenisse-energie" },
    { bb: "Ok goed dan SL. Fair.", sl: "Dankjewel BB. Dat is groot van je.", kl: "Ik doe ook mee hoor" },
    { bb: "Als ik geen koffie had zou ik ook sate doen", sl: "Nee dat doe je niet", kl: "Nee dat doe je niet" },
    { bb: "SL vandaag echt bezig 🔥", sl: "Wij zijn altijd bezig", kl: "Ik ben ook bezig. Met wachten." },
  ],
  kl_leidt: [
    { bb: "Hoe?!", sl: "WAT?!", kl: "🥟🥟🥟 IK ZEID HET" },
    { bb: "Is dit een vergissing?", sl: "Ik snap er niks van", kl: "Jullie kunnen wat van mij leren" },
    { bb: "Iemand uitleggen?", sl: "Geen idee wat er gaande is", kl: "Kroketten zijn de toekomst. Ik wist het." },
    { bb: "Dit heeft AI ook niet voorspeld", sl: "Dit heeft niemand voorspeld", kl: "IK WEL" },
    { bb: "KL leidt. Echt waar.", sl: "Ik moet even gaan zitten", kl: "Blijf maar staan, er komt meer aan" },
    { bb: "Rotterdam loopt op kroket vandaag", sl: "Rotterdam heeft echt alles", kl: "Rotterdam IS kroket" },
    { bb: "Ok respect. Dat geef ik toe.", sl: "Ik zeg niks want ik snap het niet", kl: "Dankjewel BB. Jij snapt het." },
    { bb: "Opeens snappen we Kroket Loket", sl: "Ik snap het nog steeds niet", kl: "Het vet. Het is het vet." },
    { bb: "De De Kuip gaat open voor de kroket", sl: "Dat is te ver", kl: "Is het? Is het echt te ver?" },
    { bb: "Ik ga morgen ook kroket op de kaart zetten", sl: "Dan wordt dit anders", kl: "Dan ga ik koffie schenken" },
    { bb: "Ok KL. Wat is jullie geheim?", sl: "Dat wil ik ook weten", kl: "Buitenlucht, verse olie, en een beetje geluk 🥟" },
  ],
  gelijkspel: [
    { bb: "Eerlijk spel vandaag", sl: "Zo hoort het", kl: "Voor nu..." },
    { bb: "Jullie doen best jullie best", sl: "Dat zeg ik terug", kl: "Mooie dag dit" },
    { bb: "Niemand wint, niemand verliest", sl: "Dat is ook een uitkomst", kl: "Ik noem het: evenwicht" },
    { bb: "Rotterdam als geheel wint", sl: "Mooi gezegd BB", kl: "Voor één keer eens" },
    { bb: "Studio Goud draait vandaag 🏅", sl: "Samen sterk", kl: "Zoals het hoort" },
    { bb: "Gelijk op is ook fijn", sl: "Zolang het duurt", kl: "Ik ga straks gas geven" },
    { bb: "Dit is zeldzaam", sl: "Geniet er maar van", kl: "Screenshot dit" },
    { bb: "Drie vestigingen, één team", sl: "Tot ik ga winnen", kl: "Idem" },
    { bb: "Witte de With-energie vandaag", sl: "Iedereen is blij", kl: "Tot de rekening komt" },
    { bb: "Knap van jullie eerlijk gezegd", sl: "Jij ook", kl: "Dankjewel beiden" },
    { bb: "Is het toeval of werken we goed?", sl: "Beetje van beiden", kl: "Ik zeg: talent" },
    { bb: "Als dit een race was staan we allen op het podium", sl: "Feyenoord-gevoel", kl: "Beetje wel ja" },
  ],
  bb_nul: [
    { bb: "De koffie moet nog zetten ☕", sl: "Brunch & Slapen bedoel je?", kl: "Haha eindelijk mijn moment" },
    { bb: "Wij zijn meer van de late start", sl: "Dat geloof ik ja", kl: "Geen klanten of geen zin?" },
    { bb: "Even opwarmen nog", sl: "Al hoelang opwarmen?", kl: "De kroket warmt sneller op" },
    { bb: "Kwaliteit kost tijd", sl: "Dat zeg je elke dag BB", kl: "En elke dag begrijp ik het minder" },
    { bb: "Onze klanten komen later", sl: "Ja die zitten nog te brunchen thuis", kl: "Goede" },
    { bb: "Rustige ochtend bij ons", sl: "Rustige ochtend, rustige omzet", kl: "Rustig rustig rustig" },
    { bb: "Geduld is een schone zaak", sl: "Jij hebt er veel van BB", kl: "Te veel" },
    { bb: "Wij tellen de suikerklontjes", sl: "Dat doen ze ook in Den Haag", kl: "Alleen wij doen het gratis" },
    { bb: "Nul is ook een getal", sl: "Het is het armste getal", kl: "Behalve als je BB bent" },
    { bb: "De Erasmusbrug heeft ook stille uren", sl: "De brug draait wel gewoon", kl: "Touché" },
  ],
  sl_nul: [
    { bb: "Saté op vakantie vandaag?", sl: "De oven staat op te warmen", kl: "Die oven is altijd aan het opwarmen" },
    { bb: "Heeft SL al opengedaan?", sl: "Wij beginnen later. Dat is het.", kl: "Straks inhalen toch?" },
    { bb: "Iemand de saté vergeten aan te steken?", sl: "Het steekt zichzelf wel aan", kl: "Bewijs het" },
    { bb: "SL doet het rustig aan vandaag", sl: "Wij zijn strategisch aan het wachten", kl: "Op wat dan?" },
    { bb: "Zonder SL is het stiller", sl: "Ik ben stil maar ik ben er", kl: "Dat telt niet voor de omzet" },
    { bb: "Het stokje is er maar de sate nog niet", sl: "Het stokje wacht ook", kl: "Goed gezelschap dan" },
    { bb: "SL doet net of nul normaal is", sl: "Nul is een goede basis", kl: "Voor wat precies" },
    { bb: "Saté Lounge meer Lounge dan Saté vandaag", sl: "Lounging is ook een kunst", kl: "Eén die niet betaalt" },
    { bb: "Wij maken ons zorgen SL", sl: "Lief van je BB", kl: "Doe ik ook een beetje" },
    { bb: "Straks sprint SL nog voorbij ons", sl: "Dat is de bedoeling", kl: "Dat zie ik dan wel" },
  ],
  kl_nul: [
    { bb: "Heeft KL al iemand gezien?", sl: "Ssht, laat ze slapen", kl: "Ik wacht op de juiste klant" },
    { bb: "Kroket-stand gesloten geloof ik", sl: "Of ze tellen de munten nog", kl: "Kwaliteit boven kwantiteit" },
    { bb: "KL staat er al wel hè?", sl: "Ja maar niemand wil", kl: "Ze komen wel... 🥟" },
    { bb: "Nul krokets verkocht. Nul.", sl: "Nul is een feit BB", kl: "Het vet moet eerst op temperatuur" },
    { bb: "KL doet rustig aan vandaag", sl: "KL doet altijd rustig aan", kl: "Rustig is goed voor de kroket" },
    { bb: "Ik gun ze een klantje", sl: "Ik ook eigenlijk", kl: "Ik ook. Eentje maar." },
    { bb: "Ze zoeken nog de frituurpan", sl: "Die staat er toch al?", kl: "Ik zoek de motivatie" },
    { bb: "Nul bij KL maar ze staan er", sl: "Aanwezig zijn is ook wat", kl: "Dankjewel. Dat raak me." },
    { bb: "Geen verkoop is ook data", sl: "Negatieve data", kl: "Ik noem het: baseline" },
    { bb: "KL wacht op de lunchrun", sl: "Die lunchrun duurt lang", kl: "Goed ding kan lang duren" },
    { bb: "Hoe lang staat die kroket al warm?", sl: "Te lang", kl: "Een kroket is nooit te lang warm" },
    { bb: "Rotterdam zegt: kroket kan wachten", sl: "Rotterdam zegt: geef maar", kl: "Rotterdam snapt het gewoon niet" },
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

  // Kies grappen op basis van huidige omzetten — willekeurige volgorde per scenario
  const shuffleRef = useRef<Record<string, number[]>>({});
  const grappen = useMemo(() => {
    const scenario = bepaalScenario(omzetten.bb, omzetten.sl, omzetten.kl);
    const sets     = GRAPPEN[scenario] ?? GRAPPEN.ochtend;
    // Bouw een shuffled index-lijst per scenario (eenmalig)
    if (!shuffleRef.current[scenario] || shuffleRef.current[scenario].length !== sets.length) {
      const idxs = sets.map((_, i) => i).sort(() => Math.random() - 0.5);
      shuffleRef.current[scenario] = idxs;
    }
    const volgorde = shuffleRef.current[scenario];
    return sets[volgorde[jokeIdx % volgorde.length]];
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
