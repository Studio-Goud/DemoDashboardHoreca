import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { slaFacturenOp } from "@/lib/boekhouding-kv";
import type { Factuur, ParsedFactuur } from "@/lib/factuur-ai";

export const maxDuration = 60;

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

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
- betrouwbaarheid = "hoog" als alle velden duidelijk leesbaar zijn, "middel" als sommige afgeleid zijn, "laag" als gokken nodig was
- Geen extra tekst buiten het JSON object`;

// POST /api/webhooks/factuur
// Ontvang een PDF factuur van Make.com en parseer + sla op
export async function POST(req: NextRequest) {
  // Verificeer webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const { bedrijf, pdfBase64, bestandsnaam, van, onderwerp, datum } = body as {
    bedrijf: string;
    pdfBase64: string;
    bestandsnaam?: string;
    van?: string;
    onderwerp?: string;
    datum?: string;
  };

  if (!GELDIGE_BEDRIJVEN.has(bedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "Ongeldig bedrijf (bb/sl/kl)" }, { status: 400 });
  }
  if (!pdfBase64) {
    return NextResponse.json({ error: "pdfBase64 ontbreekt" }, { status: 400 });
  }

  const datumStr = datum ?? new Date().toISOString().slice(0, 10);

  // Parseer PDF met Claude AI
  const client = new Anthropic();
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
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            } as unknown as Anthropic.TextBlockParam,
            { type: "text", text: "Extraheer de factuurdata uit dit PDF en geef een JSON object terug." },
          ],
        },
      ],
    });

    const tekst = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Geen JSON in AI response");
    parsed = JSON.parse(jsonMatch[0]) as ParsedFactuur;
  } catch {
    parsed = {
      leverancier: (van ?? "").split("@")[0] || "Onbekend",
      factuurnummer: "?",
      datum: datumStr,
      bedragInclBtw: 0,
      bedragExclBtw: 0,
      btw21: 0,
      btw9: 0,
      btwTarief: "onbekend",
      valuta: "EUR",
      omschrijving: onderwerp ?? "Onbekend",
      betrouwbaarheid: "laag",
    };
  }

  const id = `webhook-${datumStr}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, "");

  const factuur: Factuur = {
    ...parsed,
    id,
    emailDatum: datumStr,
    emailVan: van ?? "",
    emailOnderwerp: onderwerp ?? "",
    bestandsnaam: bestandsnaam ?? "factuur.pdf",
    geparseerdOp: new Date().toISOString(),
    status: parsed.betrouwbaarheid === "laag" ? "review" : "verwerkt",
  };

  await slaFacturenOp(bedrijf as BedrijfSlug, [factuur]);

  return NextResponse.json({
    ok: true,
    factuur: {
      id: factuur.id,
      leverancier: factuur.leverancier,
      bedrag: factuur.bedragInclBtw,
      status: factuur.status,
    },
  });
}
