import { NextRequest, NextResponse } from "next/server";
import { getGeldigToken, slaPendingRequisitionOp } from "@/lib/gocardless-kv";
import { maakRequisition } from "@/lib/gocardless";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

// GET /api/administratie/ing-connect/[bedrijf]
// Start de OAuth2 verbindingsflow — redirect gebruiker naar ING login
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as BedrijfSlug;
  if (!GELDIGE_BEDRIJVEN.has(bedrijf)) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }

  if (!process.env.GC_SECRET_ID || !process.env.GC_SECRET_KEY) {
    return NextResponse.json({
      error: "GoCardless niet geconfigureerd. Stel GC_SECRET_ID en GC_SECRET_KEY in Vercel in.",
    }, { status: 503 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/administratie/ing-callback?bedrijf=${bedrijf}`;

  const token = await getGeldigToken();
  const { id, link } = await maakRequisition(token, redirectUri, `${bedrijf}-${Date.now()}`);

  await slaPendingRequisitionOp(bedrijf, id);

  // Redirect direct naar ING login
  return NextResponse.redirect(link);
}
