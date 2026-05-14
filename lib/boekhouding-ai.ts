/**
 * Boekhoud-Agent: Claude categoriseert onbekende ING-transacties.
 *
 * Voor elke transactie in review-queue stelt de AI een categorie + BTW-tarief
 * voor, met een korte redenering en vertrouwensscore. Hoge vertrouwens
 * worden auto-toegepast; lagere wachten op handmatige goedkeuring.
 *
 * Model: claude-haiku-4-5 (goedkoop, ~$0.001 per 100 transacties — geschikt
 * voor categorisatie taken zonder lange context).
 *
 * Vereist ANTHROPIC_API_KEY in env-vars.
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5-20251001";

/** De categorieën zoals in ReviewPanel — moet sync blijven. */
export const CATEGORIE_OPTIES = [
  { value: "levensmiddelen",      label: "Inkoop levensmiddelen", tarief: 9  },
  { value: "huur",                label: "Huur",                  tarief: 21 },
  { value: "telecom",             label: "Telecom",               tarief: 21 },
  { value: "software",            label: "Software / abonnement", tarief: 21 },
  { value: "marketing",           label: "Marketing",             tarief: 21 },
  { value: "materiaal",           label: "Materiaal / inrichting",tarief: 21 },
  { value: "representatie",       label: "Representatie",         tarief: 21 },
  { value: "salaris",             label: "Salaris / personeel",   tarief: 0  },
  { value: "belasting",           label: "Belasting / loonheffing",tarief: 0 },
  { value: "pensioen",            label: "Pensioen",              tarief: 0  },
  { value: "sociale-lasten",      label: "Sociale lasten (UWV)",  tarief: 0  },
  { value: "bankkosten",          label: "Bankkosten",            tarief: 0  },
  { value: "verzekering",         label: "Verzekering",           tarief: 0  },
  { value: "vergoeding",          label: "Vergoeding (OV etc.)",  tarief: 0  },
  { value: "kasstorting",         label: "Kasstorting (cash → bank)", tarief: 0 },
  { value: "interne-overboeking", label: "Interne overboeking",   tarief: 0  },
  { value: "omzet",               label: "Omzet / inkomsten",     tarief: 0  },
  { value: "overig",              label: "Overig (geen BTW)",     tarief: 0  },
] as const;

export interface AiSuggestie {
  txId: string;
  categorie: string;
  tarief: 0 | 9 | 21;
  confidence: number;     // 0..1
  redenering: string;     // 1 zin
}

export interface TeBeoordelenTx {
  id: string;
  omschrijving: string;
  bedrag: number;
  datum: string;
}

const SYSTEM_PROMPT = `Je bent een Nederlandse boekhoud-assistent voor horeca-bedrijven in Rotterdam (Brunch & Brew, Saté Lounge, Het Kroket Loket).

Je krijgt een lijst onbekende ING-bankafschrift-transacties. Voor elke transactie kies je:
1. **categorie** (uit een vaste lijst, zie hieronder)
2. **tarief**: 0, 9, of 21 (% BTW)
3. **confidence**: 0..1 (hoe zeker ben je)
4. **redenering**: max 80 tekens uitleg

Categorie-opties met standaard BTW-tarief:
- "levensmiddelen" (9%): supermarkten, bakkers, slagers, koffiebranders, leveranciers eten/drinken
- "huur" (21%): pandhuur, vastgoed-eigenaren (Klepierre, Markthal)
- "telecom" (21%): KPN, T-Mobile, Odido, Vodafone
- "software" (21%): SaaS-abonnementen, hosting, Shopify, Shiftbase
- "marketing" (21%): advertenties, sociale media, drukwerk
- "materiaal" (21%): bouwmarkt (Praxis, Gamma), inrichting, gereedschap
- "representatie" (21%): zakelijke lunches, klantgeschenken
- "salaris" (0%): netto-loon uitbetaling aan medewerkers
- "belasting" (0%): Belastingdienst, loonheffing
- "pensioen" (0%): pensioenfondsen
- "sociale-lasten" (0%): UWV
- "bankkosten" (0%): ING-kosten, transactiekosten, rente
- "verzekering" (0%): verzekeringen
- "vergoeding" (0%): OV-vergoedingen, reiskosten zonder factuur
- "kasstorting" (0%): cash dat we op de bankrekening storten (omschrijving bevat "Storting") — wordt NIET als kosten of omzet geboekt (alleen kas→bank). Hoog vertrouwen bij "Storting"-omschrijving.
- "interne-overboeking" (0%): geld tussen onze eigen rekeningen (BB ↔ SL ↔ KL ↔ privé van Ricardo/Matthieu). Geen kosten, geen omzet.
- "omzet" (0%): inkomsten/binnenkomende betalingen (richting=credit)
- "overig" (0%): rest, onduidelijk, privé

Regels:
- Wees voorzichtig bij twijfel: confidence < 0.7 betekent "ik weet het niet zeker, mens moet kijken"
- Voor namen die je niet herkent: low confidence (~0.4)
- Voor duidelijke leveranciers (Albert Heijn, KPN, etc): hoog (~0.95)
- Voor credits (inkomende betalingen): meestal "omzet" tenzij duidelijk anders

OUTPUT FORMAAT: ALLEEN een JSON object met "suggesties" array. Geen extra tekst.
{
  "suggesties": [
    { "txId": "x", "categorie": "...", "tarief": 9, "confidence": 0.85, "redenering": "..." }
  ]
}`;

/**
 * Stuur batch transacties naar Claude. Returnt suggesties; faalt met
 * thrown error bij API-issues. Beller moet fallback voorzien.
 */
export async function categoriseerMetAi(
  transacties: TeBeoordelenTx[],
): Promise<AiSuggestie[]> {
  if (transacties.length === 0) return [];

  // Beperk tot 50 per call om token-budget redelijk te houden.
  // Voor grotere batches: roep meerdere keren aan vanuit beller.
  const batch = transacties.slice(0, 50);

  const userMessage = `Hier zijn ${batch.length} onbekende transacties:

\`\`\`json
${JSON.stringify(batch, null, 2)}
\`\`\`

Geef voor ELKE transactie een suggestie. Output alleen het JSON object.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const tekst = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const jsonMatch = tekst.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Geen JSON in AI-response");

  const parsed = JSON.parse(jsonMatch[0]) as { suggesties: AiSuggestie[] };
  if (!Array.isArray(parsed.suggesties)) {
    throw new Error("Geen 'suggesties' array in AI-response");
  }

  // Valideer + sanitize
  const geldigeCategorieen = new Set<string>(CATEGORIE_OPTIES.map((c) => c.value));
  return parsed.suggesties
    .filter((s) => geldigeCategorieen.has(s.categorie) && [0, 9, 21].includes(s.tarief))
    .map((s) => ({
      txId: String(s.txId),
      categorie: s.categorie,
      tarief: s.tarief as 0 | 9 | 21,
      confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0)),
      redenering: String(s.redenering ?? "").slice(0, 200),
    }));
}
