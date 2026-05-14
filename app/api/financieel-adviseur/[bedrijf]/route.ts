/**
 * POST /api/financieel-adviseur/[bedrijf]
 *   body: { vraag: string, historie?: AdviseurBericht[] }
 *   → { antwoord, kosten, tokensIn, tokensUit }
 *
 * Owner-only — antwoord bevat winst-cijfers, cashflow, DGA-info.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { vraagAdviseur, type AdviseurBericht, type BedrijfSlug } from "@/lib/financieel-adviseur";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GELDIGE = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

export async function POST(req: Request, { params }: { params: { bedrijf: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag de adviseur gebruiken" }, { status: 403 });
  }
  if (!GELDIGE.has(params.bedrijf as BedrijfSlug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY ontbreekt" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    vraag?: string;
    historie?: AdviseurBericht[];
  };
  if (!body.vraag || body.vraag.trim().length < 3) {
    return NextResponse.json({ error: "vraag te kort" }, { status: 400 });
  }
  if (body.vraag.length > 2000) {
    return NextResponse.json({ error: "vraag te lang (max 2000 tekens)" }, { status: 400 });
  }

  try {
    const resultaat = await vraagAdviseur(
      params.bedrijf as BedrijfSlug,
      body.vraag.trim(),
      Array.isArray(body.historie) ? body.historie : [],
    );
    return NextResponse.json(resultaat);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekende fout";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
