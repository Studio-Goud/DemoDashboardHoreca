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
}

const SYSTEEM_PROMPT = `Je bent een Nederlandse boekhouding-assistent. Je extraheert gestructureerde data uit PDF-facturen.

Geef ALTIJD een geldig JSON object terug met precies deze velden:
{
  "leverancier": "naam van de leverancier/bedrijf",
  "factuurnummer": "factuurnummer of referentie",
  "datum": "YYYY-MM-DD (factuurdatum, niet betaaldatum)",
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
- Als BTW-tarief mix is (bijv. zowel 21% als 9%), splits dan zo nauwkeurig mogelijk
- betrouwbaarheid = "hoog" als alle velden duidelijk leesbaar zijn, "middel" als sommige afgeleid zijn, "laag" als gokken nodig was
- Geen extra tekst buiten het JSON object`;

export async function parseFactuurPdf(factuur: RuweFactuur): Promise<Factuur> {
  const pdfBase64 = factuur.pdfBuffer.toString("base64");

  let parsed: ParsedFactuur;

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

    // Parse JSON uit de response
    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Geen JSON in response");
    parsed = JSON.parse(jsonMatch[0]) as ParsedFactuur;
  } catch (err) {
    // Fallback: sla op als review
    parsed = {
      leverancier: factuur.van.split("@")[0] ?? "Onbekend",
      factuurnummer: "?",
      datum: factuur.datum,
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

  const id = `factuur-${factuur.datum}-${factuur.uid}-${factuur.bestandsnaam.slice(0, 8)}`.replace(/[^a-zA-Z0-9-]/g, "");

  return {
    ...parsed,
    id,
    emailDatum: factuur.datum,
    emailVan: factuur.van,
    emailOnderwerp: factuur.onderwerp,
    bestandsnaam: factuur.bestandsnaam,
    geparseerdOp: new Date().toISOString(),
    status: parsed.betrouwbaarheid === "laag" ? "review" : "verwerkt",
  };
}
