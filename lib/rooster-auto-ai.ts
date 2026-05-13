/**
 * Auto-rooster v2 — Claude AI-gedreven.
 *
 * Bouwt het rooster door alle context naar Claude te sturen en hem de beste
 * toewijzingen te laten maken (kosten/baten balans). Claude geeft per dienst
 * een korte uitleg waarom precies die medewerker op die shift staat.
 *
 * Voordeel boven v1 (heuristiek): AI kan soft constraints meewegen
 * (nieuwe medewerker koppelen aan ervaren collega, voorkeurdagen, etc.)
 * en geeft transparante uitleg.
 *
 * Vereist: ANTHROPIC_API_KEY env-var.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Bedrijf } from "./sumup";
import { fetchBeschikbaarheid, fetchDienstenInRange, medewerkersPerBedrijf, createRoster } from "./rooster";
import { dashboardAggregaten } from "./dashboard-cache";
import { cruisesOpDatum } from "./cruises";
import { feestdagOpDatum } from "./feestdagen";
import { patronenVoorBedrijf, patroonSamenvatting } from "./rooster-patronen";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

const BUDGET_TARGET_PCT = 0.30;
const FALLBACK_UURLOON = 16;
const MAX_UREN_PER_WEEK = 40;

function plusDagen(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC" }).format(dt);
}

function weekdag(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function hhmmNaarMinuten(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

interface AiContext {
  bedrijf: Bedrijf;
  weekStart: string;
  weekEind: string;
  budgetTargetPct: number;
  maxUrenPerWeek: number;
  medewerkers: Array<{
    id: string;
    voornaam: string;
    achternaam: string;
    uurloon: number;
    startdatum: string | null;
    urenAlIngepland: number;
    /** Patroon uit historie (laatste 12 mnd) — null als te weinig data */
    historischPatroon: string | null;
  }>;
  dagen: Array<{
    datum: string;
    weekdag: number;
    weekdagNaam: string;
    verwachteOmzet: number;
    drukte: string;             // rustig/normaal/druk/zeer druk
    feestdag: string | null;
    vakantie: string | null;
    cruisePassagiers: number;
    cruiseSchepen: string[];
    bestaandeDiensten: Array<{
      medewerkerId: string;
      medewerker: string;
      start: string;
      eind: string;
      gepubliceerd: boolean;
    }>;
    beschikbaarheid: Array<{
      medewerkerId: string;
      status: "vrij" | "beperkt" | "niet";
      start?: string;
      eind?: string;
    }>;
  }>;
}

interface AiDienst {
  datum: string;
  medewerkerId: string;
  start: string;
  eind: string;
  rol: "opener" | "middag" | "sluiter";
  uitleg: string;
}

interface AiResponse {
  diensten: AiDienst[];
  weekSamenvatting: string;
  waarschuwingen: string[];
}

interface AutoRoosterAiResultaat {
  weekStart: string;
  weekEind: string;
  bedrijf: Bedrijf;
  ingepland: Array<{
    datum: string;
    medewerker: string;
    medewerkerId: string;
    start: string;
    eind: string;
    rol: string;
    uurloon: number;
    shiftKosten: number;
    uitleg: string;
  }>;
  overgeslagen: Array<{
    datum: string;
    reden: string;
  }>;
  weekSamenvatting: string;
  waarschuwingen: string[];
  samenvatting: {
    aantalIngepland: number;
    totaalUren: number;
    totaalLoonkosten: number;
    totaalVerwachteOmzet: number;
    loonkostPctWeek: number;
    perMedewerker: Array<{ medewerker: string; uren: number; aantal: number; loonkosten: number }>;
  };
}

const WEEKDAG_NAMEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

const SYSTEEM_PROMPT = `Je bent een ervaren horeca-rooster-planner voor Markthal HQ (Brunch & Brew, Saté Lounge, Het Kroket Loket in Rotterdam).

Je krijgt context over een week (verwachte drukte, cruise-passagiers, feestdagen, weer, openingsuren) plus een lijst medewerkers met hun beschikbaarheid en uurloon. Jij maakt het optimale rooster.

DOEL: maximale omzet halen met minimale loonkosten. Target loonkost-percentage = 30% van verwachte omzet. Liever onder, niet boven.

REGELS:
1. Plan medewerkers alleen in op dagen waarop ze 'vrij' of 'beperkt' beschikbaar zijn. NOOIT iemand met status 'niet'.
2. Bij 'beperkt' beschikbaarheid: pas shift-tijden aan binnen hun window (start/eind). Minimum 3 uur per shift.
3. Maximaal 40u per medewerker per week.
4. Geen dubbele shifts op dezelfde dag voor één medewerker.
5. Sla dagen met al gepubliceerde diensten OVER (manager heeft die al goedgekeurd).
6. Sla concept-diensten WEL over die al exact dezelfde shift dekken (geen duplicaten).
7. Verdeel uren eerlijk over medewerkers — niet 1 iemand 40u en de rest 0.
8. Geef voorrang aan medewerkers met lager uurloon bij gelijke geschiktheid (kosten-min).
9. Bij feestdag met impact='dicht': geen diensten plannen.
10. Bij Marathon Rotterdam: extra bezetting (alle ploegen aanwezig 09:30/10:00 – 20:00).

DRUKTE-RICHTLIJNEN per vestiging:
- Brunch & Brew (bb), openingsuren ~09:30–20:00:
  * normaal: 2 mensen (opener-shifts 09:30–15:00/16:00)
  * druk: 4 mensen (2 openers + 1 middag + 1 sluiter)
  * zeer druk: 5 mensen (2 openers tot 18:00 + 1 middag + 2 sluiters)
- Saté Lounge (sl), openingsuren ~10:00–20:00:
  * normaal: 1 persoon hele dag
  * druk: 3 mensen
  * zeer druk: 4 mensen
- Het Kroket Loket (kl), openingsuren ~10:00–20:00:
  * normaal: 2 mensen
  * druk: 4 mensen
  * zeer druk: 6 mensen

Op zaterdag: minstens 'druk' niveau. Bij cruise ≥3000 pax: minstens 'druk'. Bij ≥5000 pax: 'zeer druk'. Op zondag: kleinere bezetting (2 mensen ongeacht drukte).

HISTORISCHE PATRONEN: bij elke medewerker zie je een veld 'historischPatroon' met een korte samenvatting van hun gedrag in de afgelopen 12 maanden (bv. "180 diensten — werkt vaak op ma/di; typisch 09:30–16:00 (6.2u gem.); vaak samen met Sophie"). Gebruik dit als een SOFT HINT:
- Als een medewerker historisch op dinsdag werkt en deze week dinsdag beschikbaar is → plan hem/haar daar
- Probeer vaste samenwerkings-paren te respecteren
- Houd typische shift-tijden aan tenzij dat conflicteert met beschikbaarheid
- Patronen zijn LEIDEND maar niet ABSOLUUT: beschikbaarheid en kosten-target overrulen altijd.
- Voor medewerkers zonder patroon ('historischPatroon: null'): vertrouw op uurloon-volgorde en eerlijke verdeling.

OUTPUT FORMAAT (alleen JSON, geen extra tekst):
{
  "diensten": [
    {
      "datum": "YYYY-MM-DD",
      "medewerkerId": "12",
      "start": "HH:MM",
      "eind": "HH:MM",
      "rol": "opener" | "middag" | "sluiter",
      "uitleg": "korte uitleg (max 80 tekens) waarom deze medewerker hier"
    }
  ],
  "weekSamenvatting": "1-2 zinnen over de hele week, met verwachte loonkost-%",
  "waarschuwingen": ["string"]
}

Gebruik medewerker-IDs uit de context, niet namen. Datums in YYYY-MM-DD. Tijden in HH:MM (24u). Uitleg in het Nederlands.`;

async function bouwContext(bedrijf: Bedrijf, weekStart: string): Promise<AiContext> {
  const weekEind = plusDagen(weekStart, 6);

  const [medewerkers, beschikbaarheid, bestaandeDiensten, agg, patronen] = await Promise.all([
    medewerkersPerBedrijf(bedrijf),
    fetchBeschikbaarheid(weekStart, weekEind),
    fetchDienstenInRange(weekStart, weekEind),
    dashboardAggregaten(bedrijf),
    // Historische patronen — soft hint voor de AI, faalt netjes met lege lijst
    patronenVoorBedrijf(bedrijf).catch(() => []),
  ]);

  // Patroon-lookup per medewerker
  const patroonMap = new Map<string, string>();
  for (const p of patronen) {
    patroonMap.set(p.medewerkerId, patroonSamenvatting(p));
  }

  const dienstenDitBedrijf = bestaandeDiensten.filter((d) => d.bedrijf === bedrijf);

  // Uren al ingepland per medewerker
  const urenIngepland = new Map<string, number>();
  for (const d of dienstenDitBedrijf) {
    urenIngepland.set(d.medewerker.id, (urenIngepland.get(d.medewerker.id) ?? 0) + d.uren);
  }

  const prognoseMap = new Map<string, { verwacht: number; druk: string }>();
  for (const p of agg.prognose) {
    prognoseMap.set(p.datum, { verwacht: p.verwacht, druk: p.druk });
  }

  const dagen: AiContext["dagen"] = [];
  for (let i = 0; i < 7; i++) {
    const datum = plusDagen(weekStart, i);
    const wd = weekdag(datum);
    const [y, m, dd] = datum.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, dd));
    const feest = feestdagOpDatum(dt);
    const cruises = cruisesOpDatum(datum);
    const prog = prognoseMap.get(datum);

    dagen.push({
      datum,
      weekdag: wd,
      weekdagNaam: WEEKDAG_NAMEN[wd],
      verwachteOmzet: prog?.verwacht ?? 0,
      drukte: prog?.druk ?? "onbekend",
      feestdag: feest?.naam ?? null,
      vakantie: null,  // vakantie info reeds in feestdag, hier weglaten
      cruisePassagiers: cruises.reduce((s, c) => s + c.passagiers, 0),
      cruiseSchepen: cruises.map((c) => `${c.ship} (${c.passagiers} pax)`),
      bestaandeDiensten: dienstenDitBedrijf
        .filter((d) => d.datum === datum)
        .map((d) => ({
          medewerkerId: d.medewerker.id,
          medewerker: `${d.medewerker.voornaam} ${d.medewerker.naam.split(" ").slice(-1)[0]}`,
          start: d.start,
          eind: d.eind,
          gepubliceerd: d.gepubliceerd,
        })),
      beschikbaarheid: beschikbaarheid
        .filter((b) => b.datum === datum && b.status !== "onbekend")
        .map((b) => ({
          medewerkerId: b.userId,
          status: b.status as "vrij" | "beperkt" | "niet",
          start: b.start,
          eind: b.eind,
        })),
    });
  }

  return {
    bedrijf,
    weekStart,
    weekEind,
    budgetTargetPct: BUDGET_TARGET_PCT,
    maxUrenPerWeek: MAX_UREN_PER_WEEK,
    medewerkers: medewerkers
      .filter((m) => !m.einddatum)
      .map((m) => ({
        id: m.id,
        voornaam: m.voornaam,
        achternaam: m.achternaam,
        uurloon: m.uurloon ?? FALLBACK_UURLOON,
        startdatum: m.startdatum,
        urenAlIngepland: urenIngepland.get(m.id) ?? 0,
        historischPatroon: patroonMap.get(m.id) ?? null,
      })),
    dagen,
  };
}

function valideer(
  response: AiResponse,
  context: AiContext,
): { geldig: boolean; redenen: string[]; gefilterd: AiDienst[] } {
  const redenen: string[] = [];
  const gefilterd: AiDienst[] = [];

  const geldigeIds = new Set(context.medewerkers.map((m) => m.id));
  const datumsInWeek = new Set(context.dagen.map((d) => d.datum));
  const gepubliceerdDagen = new Set(
    context.dagen.filter((d) => d.bestaandeDiensten.some((bd) => bd.gepubliceerd)).map((d) => d.datum),
  );

  // Per medewerker per dag al toegewezen tijden om duplicaten te vangen
  const toegewezen = new Map<string, Array<{ start: number; eind: number }>>();

  for (const d of response.diensten) {
    if (!datumsInWeek.has(d.datum)) {
      redenen.push(`Onbekende datum: ${d.datum}`);
      continue;
    }
    if (gepubliceerdDagen.has(d.datum)) {
      redenen.push(`Dag ${d.datum} heeft al gepubliceerde diensten — overgeslagen`);
      continue;
    }
    if (!geldigeIds.has(d.medewerkerId)) {
      redenen.push(`Onbekende medewerker-ID: ${d.medewerkerId} op ${d.datum}`);
      continue;
    }
    if (!/^\d{2}:\d{2}$/.test(d.start) || !/^\d{2}:\d{2}$/.test(d.eind)) {
      redenen.push(`Ongeldige tijd-notatie bij ${d.medewerkerId} ${d.datum}`);
      continue;
    }
    const startMin = hhmmNaarMinuten(d.start);
    const eindMin = hhmmNaarMinuten(d.eind);
    if (eindMin <= startMin) {
      redenen.push(`Eindtijd voor of gelijk aan starttijd bij ${d.medewerkerId} ${d.datum}`);
      continue;
    }
    if (eindMin - startMin < 3 * 60) {
      redenen.push(`Te korte shift (<3u) bij ${d.medewerkerId} ${d.datum}`);
      continue;
    }

    // Check beschikbaarheid
    const dag = context.dagen.find((dd) => dd.datum === d.datum)!;
    const besch = dag.beschikbaarheid.find((b) => b.medewerkerId === d.medewerkerId);
    if (besch?.status === "niet") {
      redenen.push(`Medewerker ${d.medewerkerId} is niet beschikbaar op ${d.datum}`);
      continue;
    }
    if (besch?.status === "beperkt" && besch.start && besch.eind) {
      const bStart = hhmmNaarMinuten(besch.start);
      const bEind = hhmmNaarMinuten(besch.eind);
      if (startMin < bStart || eindMin > bEind) {
        redenen.push(`Shift ${d.start}-${d.eind} ligt buiten beschikbaarheid ${besch.start}-${besch.eind} (${d.medewerkerId} ${d.datum})`);
        continue;
      }
    }

    // Geen overlap met andere shifts van dezelfde medewerker dezelfde dag
    const key = `${d.medewerkerId}|${d.datum}`;
    const reeds = toegewezen.get(key) ?? [];
    const overlap = reeds.some((r) => !(eindMin <= r.start || startMin >= r.eind));
    if (overlap) {
      redenen.push(`Overlappende shifts voor ${d.medewerkerId} op ${d.datum}`);
      continue;
    }
    reeds.push({ start: startMin, eind: eindMin });
    toegewezen.set(key, reeds);

    gefilterd.push(d);
  }

  return { geldig: redenen.length === 0, redenen, gefilterd };
}

export async function genereerAutoRoosterAi(
  bedrijf: Bedrijf,
  weekStart: string,
): Promise<AutoRoosterAiResultaat> {
  const context = await bouwContext(bedrijf, weekStart);

  // Stuur compact JSON naar Claude
  const userMessage = `Hier is de context voor de week ${weekStart} (maandag) t/m ${plusDagen(weekStart, 6)} (zondag):

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Maak het optimale rooster volgens de regels. Geef alleen het JSON-object terug.`;

  let aiResponse: AiResponse;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const tekst = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Geen JSON in AI-response");
    aiResponse = JSON.parse(jsonMatch[0]) as AiResponse;
  } catch (e) {
    throw new Error(`AI-rooster generatie mislukt: ${e instanceof Error ? e.message : "onbekend"}`);
  }

  const { gefilterd, redenen } = valideer(aiResponse, context);

  // Schrijf gefilterde diensten naar DB als concept
  const ingepland: AutoRoosterAiResultaat["ingepland"] = [];
  for (const d of gefilterd) {
    const m = context.medewerkers.find((mm) => mm.id === d.medewerkerId)!;
    const uren = (hhmmNaarMinuten(d.eind) - hhmmNaarMinuten(d.start)) / 60;
    const shiftKosten = uren * m.uurloon;

    await createRoster({
      bedrijf,
      userId: d.medewerkerId,
      datum: d.datum,
      start: d.start,
      eind: d.eind,
      pauzeMin: 0,
      notitie: `AI-rooster: ${d.uitleg}`,
      gepubliceerd: false,
    });

    ingepland.push({
      datum: d.datum,
      medewerker: `${m.voornaam} ${m.achternaam}`,
      medewerkerId: m.id,
      start: d.start,
      eind: d.eind,
      rol: d.rol,
      uurloon: m.uurloon,
      shiftKosten: Math.round(shiftKosten * 100) / 100,
      uitleg: d.uitleg,
    });
  }

  // Samenvatting
  const perMedewerkerMap = new Map<string, { uren: number; aantal: number; loonkosten: number }>();
  for (const r of ingepland) {
    const u = (hhmmNaarMinuten(r.eind) - hhmmNaarMinuten(r.start)) / 60;
    const cur = perMedewerkerMap.get(r.medewerker) ?? { uren: 0, aantal: 0, loonkosten: 0 };
    perMedewerkerMap.set(r.medewerker, {
      uren: cur.uren + u,
      aantal: cur.aantal + 1,
      loonkosten: cur.loonkosten + r.shiftKosten,
    });
  }
  const perMedewerker = Array.from(perMedewerkerMap.entries())
    .map(([medewerker, v]) => ({
      medewerker,
      uren: Math.round(v.uren * 10) / 10,
      aantal: v.aantal,
      loonkosten: Math.round(v.loonkosten * 100) / 100,
    }))
    .sort((a, b) => b.uren - a.uren);

  const totaalUren = perMedewerker.reduce((s, p) => s + p.uren, 0);
  const totaalLoonkosten = perMedewerker.reduce((s, p) => s + p.loonkosten, 0);
  const totaalVerwachteOmzet = context.dagen.reduce((s, d) => s + d.verwachteOmzet, 0);

  return {
    weekStart,
    weekEind: context.weekEind,
    bedrijf,
    ingepland,
    overgeslagen: redenen.map((r) => ({ datum: weekStart, reden: r })),
    weekSamenvatting: aiResponse.weekSamenvatting,
    waarschuwingen: aiResponse.waarschuwingen ?? [],
    samenvatting: {
      aantalIngepland: ingepland.length,
      totaalUren: Math.round(totaalUren * 10) / 10,
      totaalLoonkosten: Math.round(totaalLoonkosten * 100) / 100,
      totaalVerwachteOmzet: Math.round(totaalVerwachteOmzet * 100) / 100,
      loonkostPctWeek: totaalVerwachteOmzet > 0 ? totaalLoonkosten / totaalVerwachteOmzet : 0,
      perMedewerker,
    },
  };
}
