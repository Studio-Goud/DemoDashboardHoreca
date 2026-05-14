/**
 * Boekhoud-Agent endpoint.
 *
 * POST /api/administratie/ing/[bedrijf]/ai-categoriseer?jaar=2026
 *   body: { autoToepassenAbove?: 0.85 }
 *
 * Pakt alle transacties met status 'review' van het jaar, stuurt ze in
 * batches van max 50 naar Claude Haiku, en past suggesties toe:
 * - confidence >= autoToepassenAbove (default 0.85): direct als 'auto' opslaan
 *   + regel opslaan in geleerde-regels (voor toekomstige uploads)
 * - lager: blijft 'review' maar suggestie wordt teruggegeven aan UI zodat
 *   die het kan tonen als voorstel met "Accepteer" knop.
 *
 * Owner-only (Anthropic-credits kosten geld).
 */
import { NextRequest, NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { haalIngOp, updateIngTransactie } from "@/lib/boekhouding-kv";
import { categoriseerMetAi, type AiSuggestie } from "@/lib/boekhouding-ai";
import { slaRegelOp, extracteerPatroon } from "@/lib/ing-leer-regels";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function berekenBtw(bedrag: number, tarief: 0 | 9 | 21): { btw21: number; btw9: number } {
  const rnd = (n: number) => Math.round(n * 100) / 100;
  if (tarief === 21) return { btw21: rnd(bedrag - bedrag / 1.21), btw9: 0 };
  if (tarief === 9)  return { btw21: 0, btw9: rnd(bedrag - bedrag / 1.09) };
  return { btw21: 0, btw9: 0 };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } },
) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag AI-categoriseren" }, { status: 403 });
  }
  if (!GELDIGE_BEDRIJVEN.has(params.bedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }
  const bedrijf = params.bedrijf as BedrijfSlug;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt in productie-env." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());
  const body = (await req.json().catch(() => ({}))) as { autoToepassenAbove?: number };
  const autoBoven = body.autoToepassenAbove ?? 0.85;

  // Alleen review + uitgaven (credits = omzet, geen categorisatie nodig)
  const alle = await haalIngOp(bedrijf, jaar);
  const review = alle.filter((t) => t.btwStatus === "review" && t.richting === "debit");

  if (review.length === 0) {
    return NextResponse.json({
      ok: true,
      bekeken: 0,
      autoToegepast: 0,
      suggesties: [],
      melding: "Geen transacties in review-queue.",
    });
  }

  // Batches van 50 — AI-laag heeft daar een soft-limit op
  const alleSuggesties: AiSuggestie[] = [];
  const teBeoordelen = review.map((t) => ({
    id: t.id,
    omschrijving: t.omschrijving,
    bedrag: t.bedrag,
    datum: t.datum,
  }));
  for (let i = 0; i < teBeoordelen.length; i += 50) {
    const batch = teBeoordelen.slice(i, i + 50);
    try {
      const sug = await categoriseerMetAi(batch);
      alleSuggesties.push(...sug);
    } catch (e) {
      return NextResponse.json(
        {
          error: `AI-categorisatie mislukt op batch ${Math.floor(i / 50) + 1}: ${e instanceof Error ? e.message : "onbekend"}`,
          tot_dusver: alleSuggesties.length,
        },
        { status: 500 },
      );
    }
  }

  // Pas auto-suggesties (>= drempel) direct toe en sla regels op.
  let autoToegepast = 0;
  for (const sug of alleSuggesties) {
    if (sug.confidence < autoBoven) continue;
    const tx = review.find((t) => t.id === sug.txId);
    if (!tx) continue;
    const [jaar_, maand_] = tx.datum.split("-").map(Number);
    const { btw21, btw9 } = berekenBtw(tx.bedrag, sug.tarief);
    await updateIngTransactie(bedrijf, jaar_, maand_, tx.id, {
      btw21, btw9, categorie: sug.categorie, btwStatus: "auto",
    });
    // Leer-regel ook opslaan zodat volgende upload het zelf herkent
    const patroon = extracteerPatroon(tx.omschrijving);
    if (patroon) {
      await slaRegelOp(bedrijf, patroon, sug.categorie, sug.tarief, "ai", sug.confidence);
    }
    autoToegepast++;
  }

  return NextResponse.json({
    ok: true,
    bekeken: review.length,
    autoToegepast,
    suggesties: alleSuggesties,
    melding: `${autoToegepast} transacties automatisch verwerkt. ${alleSuggesties.length - autoToegepast} suggesties hebben jouw goedkeuring nodig.`,
  });
}
