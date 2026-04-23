import Anthropic from "@anthropic-ai/sdk";
import type { RuweFactuur } from "./imap-facturen";

const client = new Anthropic();

export interface ParsedFactuur {
  leverancier: string;
  factuurnummer: string;
  datum: string;          // YYYY-MM-DD
  bedragInclBtw: number;
  bedragExclBtw: number;
  btw21: number;
  btw9: number;
  btwTarief: "21%" | "9%" | "mix" | "0%" | "onbekend";
  valuta: string;
  omschrijving: string;
  betrouwbaarheid: "hoog" | "middel" | "laag";
}

export interface Factuur extends ParsedFactuur {
  id: string;
  emailDatum: string;
  emailVan: string;
  emailOnderwerp: string;
  bestandsnaam: string;
  geparseerdOp: string;
  status: "verwerkt" | "review";
  reviewReden?: string;
}

const SYSTEEM_PROMPT = `Je bent een Nederlandse boekhouding-assistent. Je extraheert gestructureerde data uit PDF-facturen.

Geef ALTIJD een geldig JSON object terug met precies deze velden:
{
  "leverancier": "naam van de leverancier/bedrijf",
  "factuurnummer": "factuurnummer of referentie",
  "datum": "YYYY-MM-DD (factuurdatum zoals op de factuur staat, niet de betaaldatum of vervaldatum)",
  "bedragInclBtw": 0.00,
  "bedragExclBtw": 0.00,
  "btw21": 0.00,
  "btw9": 0.00,
  "btwTarief": "21%" | "9%" | "mix" | "0%" | "onbekend",
  "valuta": "EUR",
  "omschrijving": "korte omschrijving van wat de factuur betreft",
  "betrouwbaarheid": "hoog" | "middel" | "laag"
}

Regels:
- Alle bedragen in euro, 2 decimalen
- bedragInclBtw = bedragExclBtw + btw21 + btw9 (controleer dit altijd)
- Als BTW-tarief mix is (bijv. zowel 21% als 9%), splits dan zo nauwkeurig mogelijk
- betrouwbaarheid = "hoog" als alle velden duidelijk leesbaar zijn, "middel" als sommige afgeleid zijn, "laag" als gokken nodig was
- Als bedragInclBtw niet leesbaar is, zet dan 0 en betrouwbaarheid op "laag"
- Geen extra tekst buiten het JSON object`;

function valideerParsedFactuur(
  parsed: ParsedFactuur,
  emailDatum: string,
): { geldig: boolean; redenen: string[] } {
  const redenen: string[] = [];

  // 1. Datum moet een geldig formaat hebben
  const datumRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!datumRegex.test(parsed.datum)) {
    redenen.push(`Ongeldige datumnotatie: "${parsed.datum}"`);
  } else {
    const factuurDatum = new Date(parsed.datum);
    const email = new Date(emailDatum);
    const nu = new Date();

    // Factuur mag niet in de toekomst liggen t.o.v. e-maildatum
    if (factuurDatum > new Date(email.getTime() + 7 * 24 * 60 * 60 * 1000)) {
      redenen.push(`Factuurdatum (${parsed.datum}) ligt na e-maildatum (${emailDatum})`);
    }

    // Factuur mag niet ouder dan 3 jaar zijn
    const drieJaarGeleden = new Date(nu.getFullYear() - 3, nu.getMonth(), nu.getDate());
    if (factuurDatum < drieJaarGeleden) {
      redenen.push(`Factuurdatum (${parsed.datum}) is meer dan 3 jaar oud`);
    }
  }

  // 2. Bedrag moet positief zijn
  if (parsed.bedragInclBtw <= 0) {
    redenen.push(`Bedrag incl. BTW is ${parsed.bedragInclBtw} (moet > 0 zijn)`);
  }

  // 3. BTW mag niet hoger zijn dan het totaalbedrag
  const totaleBtw = parsed.btw21 + parsed.btw9;
  if (totaleBtw > parsed.bedragInclBtw + 0.02) {
    redenen.push(`BTW (${totaleBtw}) is hoger dan bedragInclBtw (${parsed.bedragInclBtw})`);
  }

  // 4. bedragExclBtw + BTW moet overeenkomen met bedragInclBtw (tolerantie €0.05)
  if (parsed.bedragInclBtw > 0) {
    const verwacht = parsed.bedragExclBtw + totaleBtw;
    if (Math.abs(verwacht - parsed.bedragInclBtw) > 0.05) {
      redenen.push(
        `Bedragen kloppen niet: excl (${parsed.bedragExclBtw}) + BTW (${totaleBtw}) = ${verwacht.toFixed(2)}, maar incl = ${parsed.bedragInclBtw}`,
      );
    }
  }

  return { geldig: redenen.length === 0, redenen };
}

export async function parseFactuurPdf(factuur: RuweFactuur): Promise<Factuur> {
  const pdfBase64 = factuur.pdfBuffer.toString("base64");

  let parsed: ParsedFactuur;
  let parseError = false;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            } as unknown as Anthropic.TextBlockParam,
            {
              type: "text",
              text: "Extraheer de factuurdata uit dit PDF en geef een JSON object terug.",
            },
          ],
        },
      ],
    });

    const tekst = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Geen JSON in response");
    parsed = JSON.parse(jsonMatch[0]) as ParsedFactuur;
  } catch {
    parseError = true;
    // Fallback: alles leeg, zodat validatie hem markeert als review
    parsed = {
      leverancier: factuur.van.split("@")[0] ?? "Onbekend",
      factuurnummer: "?",
      datum: factuur.datum, // e-maildatum als noodoplossing
      bedragInclBtw: 0,
      bedragExclBtw: 0,
      btw21: 0,
      btw9: 0,
      btwTarief: "onbekend",
      valuta: "EUR",
      omschrijving: factuur.onderwerp,
      betrouwbaarheid: "laag",
    };
  }

  const { geldig, redenen } = valideerParsedFactuur(parsed, factuur.datum);

  // Status bepalen: review als AI onzeker was, parse mislukte, of validatie faalt
  const isReview = parseError || parsed.betrouwbaarheid === "laag" || !geldig;
  const reviewReden = [
    parseError ? "AI kon PDF niet lezen" : null,
    !geldig ? redenen.join("; ") : null,
  ]
    .filter(Boolean)
    .join(" | ") || undefined;

  const id = `factuur-${factuur.datum}-${factuur.uid}-${factuur.bestandsnaam.slice(0, 8)}`.replace(
    /[^a-zA-Z0-9-]/g,
    "",
  );

  return {
    ...parsed,
    id,
    emailDatum: factuur.datum,
    emailVan: factuur.van,
    emailOnderwerp: factuur.onderwerp,
    bestandsnaam: factuur.bestandsnaam,
    geparseerdOp: new Date().toISOString(),
    status: isReview ? "review" : "verwerkt",
    reviewReden,
  };
}
