/**
 * AI Financieel-adviseur — Claude Sonnet beantwoordt vragen over de
 * financiele staat van een vestiging. We verzamelen alle relevante data
 * (P&L, cashflow, loonkost-ratio, DGA, vaste lasten, recente trends) als
 * compact JSON-context, sturen mee met de gebruikersvraag, en krijgen
 * een onderbouwd antwoord terug.
 *
 * Model: claude-sonnet-4-6 — Sonnet omdat we redenering over cijfers
 * willen, niet alleen classificatie. Cost ~€0.03-0.06 per vraag.
 */
import Anthropic from "@anthropic-ai/sdk";
import { berekenMaand } from "./boekhouding";
import { haalIngOp, haalFacturenOp, haalContantOp } from "./boekhouding-kv";
import { cashflowProjectie } from "./cashflow";
import { dgaUittreksel, energieUittreksel } from "./dga-energie";
import { dashboardAggregaten } from "./dashboard-cache";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/client";

export type BedrijfSlug = "bb" | "sl" | "kl";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

const BEDRIJF_NAAM: Record<BedrijfSlug, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

export interface AdviseurBericht {
  rol: "user" | "assistant";
  tekst: string;
}

export interface AdviseurAntwoord {
  antwoord: string;
  /** Geschatte cost in EUR voor deze call. */
  kosten: number;
  /** Tokens in/out voor transparantie. */
  tokensIn: number;
  tokensUit: number;
}

/**
 * Verzamel alle relevante data over het bedrijf in een compact summary.
 * Wordt elke beurt opnieuw opgehaald — Claude krijgt zo de meest recente
 * cijfers en oude conversaties hoeven niet de hele context opnieuw te dragen.
 */
async function bouwContext(bedrijf: BedrijfSlug): Promise<string> {
  const nu = new Date();
  const jaar = nu.getFullYear();
  const maand = nu.getMonth() + 1;

  // Parallel ophalen
  const [
    ingTxs,
    facturen,
    contant,
    cashflow,
    dga,
    energie,
    bedrijfsRow,
    agg,
  ] = await Promise.all([
    haalIngOp(bedrijf, jaar),
    haalFacturenOp(bedrijf, jaar),
    haalContantOp(bedrijf, jaar),
    cashflowProjectie(bedrijf, 60).catch(() => null),
    dgaUittreksel(bedrijf, jaar).catch(() => null),
    energieUittreksel(bedrijf, jaar).catch(() => null),
    db.select({
      werkgeverslastenPct: schema.departments.werkgeverslastenPct,
    }).from(schema.departments).where(eq(schema.departments.slug, bedrijf)).then(r => r[0]),
    dashboardAggregaten(bedrijf).catch(() => null),
  ]);

  // P&L huidige maand
  const omzetExtern = agg?.kerncijfers?.dezeMaand?.omzet ?? 0;
  const omzetBtw = Math.round((omzetExtern - omzetExtern / 1.09) * 100) / 100;
  const pnl = berekenMaand(jaar, maand, ingTxs, facturen, contant, omzetExtern, omzetBtw);

  const werkgeverslasten = bedrijfsRow?.werkgeverslastenPct
    ? Number(bedrijfsRow.werkgeverslastenPct)
    : 27;
  const loonAllIn = pnl.salarissen * (1 + 0.0833 + 0.08 + werkgeverslasten / 100);
  const loonkostRatio = pnl.omzetBruto > 0 ? (loonAllIn / pnl.omzetBruto) * 100 : 0;

  // Top categorieën kosten huidige maand
  const topCats = Object.entries(pnl.categorieBreakdown ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, bedrag]) => ({ categorie: cat, bedrag: Math.round(bedrag * 100) / 100 }));

  // Recente grote transacties (laatste 14 dagen, > €100, debit)
  const veertienDagenGeleden = new Date(nu);
  veertienDagenGeleden.setDate(nu.getDate() - 14);
  const recenteGrote = ingTxs
    .filter((t) => t.richting === "debit" && t.bedrag > 100 && t.datum >= veertienDagenGeleden.toISOString().slice(0, 10))
    .slice(0, 10)
    .map((t) => ({ datum: t.datum, bedrag: t.bedrag, omschrijving: t.omschrijving.slice(0, 40), categorie: t.categorie }));

  const ctx = {
    bedrijf: BEDRIJF_NAAM[bedrijf],
    datum_vandaag: nu.toISOString().slice(0, 10),
    jaar,
    huidige_maand: maand,
    huidige_maand_pnl: {
      omzet_bruto: pnl.omzetBruto,
      kosten_totaal: pnl.kostenTotaal,
      salarissen_bruto: pnl.salarissen,
      werkgeverslasten_pct: werkgeverslasten,
      loon_all_in: Math.round(loonAllIn * 100) / 100,
      loonkost_ratio_pct: Math.round(loonkostRatio * 10) / 10,
      bruto_resultaat: pnl.brutoResultaat,
      netto_resultaat: pnl.nettoResultaat,
      btw_te_voldoen: pnl.btwTeVoldoen,
      top_kostenposten: topCats,
    },
    cashflow_60_dagen: cashflow ? {
      // Cumulatief netto-effect vanaf 0 over de volgende 60 dagen.
      eind_delta: cashflow.eindDelta,
      laagste_delta: cashflow.laagsteDelta,
      laagste_datum: cashflow.laagsteDatum,
      gevaren_dagen: cashflow.gevarenDagen.length,
    } : null,
    dga_ytd: dga ? {
      totaal: dga.totaal,
      echt_rotterdams: dga.perDga.find((d) => d.categorie === "dga-er")?.totaal ?? 0,
      mp5: dga.perDga.find((d) => d.categorie === "dga-mp5")?.totaal ?? 0,
    } : null,
    energie_ytd: energie ? {
      totaal: energie.totaal,
      gem_per_maand: energie.gemPerMaand,
      top_leverancier: energie.perLeverancier[0]?.leverancier ?? null,
    } : null,
    recente_grote_uitgaven: recenteGrote,
  };

  return JSON.stringify(ctx, null, 2);
}

const SYSTEM_PROMPT = `Je bent een Nederlandse financieel adviseur voor Rotterdamse horeca-ondernemers. Je analyseert hun cijfers en geeft concrete, eerlijke adviezen.

Werkwijze:
- Beantwoord in het Nederlands, professioneel maar toegankelijk (de eigenaars zijn praktijkmensen, geen accountants).
- Gebruik concrete getallen uit de context die je krijgt — verzin nooit cijfers.
- Bij investeringsvragen: kijk naar cashflow, niet alleen winst. Liquiditeit is voor horeca cruciaal.
- Bij "hoe gaat het?": geef een eerlijke samenvatting met 2-3 highlights en eventuele zorgpunten.
- Bij scenario-vragen ("wat als..."): doe een onderbouwde schatting.
- Wees beknopt: max ~150 woorden tenzij de vraag echt diepgang vraagt.
- Benchmark horeca:
  • Loonkost-ratio: 28-32% gezond, >35% te hoog
  • Bruto-marge horeca: typisch 65-70%
  • Netto-resultaat: 8-15% van omzet is gezond
- Bij financiele waarschuwingen (loonkost te hoog, cashflow-dip, te veel DGA opgenomen): zeg het rechtuit maar zonder paniek.

Je krijgt elke beurt een JSON-context met de actuele cijfers. Lees die door en baseer je antwoord daarop.`;

export async function vraagAdviseur(
  bedrijf: BedrijfSlug,
  vraag: string,
  historie: AdviseurBericht[] = [],
): Promise<AdviseurAntwoord> {
  const context = await bouwContext(bedrijf);

  // Bouw messages: eerst recente context als user-message, daarna conversatie
  const messages: Anthropic.MessageParam[] = [];
  // Recente historie meegeven (laatste 6 berichten — houdt context-gebruik beheersbaar)
  const recentHist = historie.slice(-6);
  for (const h of recentHist) {
    messages.push({ role: h.rol, content: h.tekst });
  }
  // Huidige vraag + actuele context
  messages.push({
    role: "user",
    content: `[Actuele financiele context]
\`\`\`json
${context}
\`\`\`

[Vraag van de eigenaar]
${vraag}`,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages,
  });

  const antwoord = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  // Geschatte kosten (Sonnet 4.6: $3/MTok in, $15/MTok out → in EUR ~0.92×)
  const tokensIn = response.usage.input_tokens;
  const tokensUit = response.usage.output_tokens;
  const kostenUsd = (tokensIn / 1_000_000) * 3 + (tokensUit / 1_000_000) * 15;
  const kosten = Math.round(kostenUsd * 0.92 * 1000) / 1000;

  return { antwoord, kosten, tokensIn, tokensUit };
}
