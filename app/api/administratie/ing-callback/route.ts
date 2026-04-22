import { NextRequest, NextResponse } from "next/server";
import { getGeldigToken, haalPendingRequisition, slaVerbindingOp } from "@/lib/gocardless-kv";
import { haalRequisition, haalAccountDetails } from "@/lib/gocardless";

type BedrijfSlug = "bb" | "sl" | "kl";

// GET /api/administratie/ing-callback?bedrijf=sl&ref=...
// GoCardless stuurt de gebruiker hierheen na ING-login
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bedrijf = searchParams.get("bedrijf") as BedrijfSlug | null;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;

  if (!bedrijf) {
    return NextResponse.redirect(`${baseUrl}/administratie/sl?gc_error=missing_bedrijf`);
  }

  const requisitionId = await haalPendingRequisition(bedrijf);
  if (!requisitionId) {
    return NextResponse.redirect(`${baseUrl}/administratie/${bedrijf}?gc_error=geen_requisition`);
  }

  try {
    const token = await getGeldigToken();
    const requisition = await haalRequisition(token, requisitionId);

    if (requisition.status !== "LN" || requisition.accounts.length === 0) {
      return NextResponse.redirect(
        `${baseUrl}/administratie/${bedrijf}?gc_error=niet_gelinkt&status=${requisition.status}`
      );
    }

    // Haal account details op voor alle accounts
    const accounts = await Promise.all(
      requisition.accounts.map((id) => haalAccountDetails(token, id))
    );

    await slaVerbindingOp(bedrijf, requisitionId, accounts);

    return NextResponse.redirect(`${baseUrl}/administratie/${bedrijf}?gc_success=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.redirect(
      `${baseUrl}/administratie/${bedrijf}?gc_error=${encodeURIComponent(msg)}`
    );
  }
}
