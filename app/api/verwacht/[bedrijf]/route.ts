import { NextRequest, NextResponse } from "next/server";
import { dashboardAggregaten } from "@/lib/dashboard-cache";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as Bedrijf;
  if (!["bb", "sl", "kl"].includes(bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  try {
    const agg = await dashboardAggregaten(bedrijf);
    return NextResponse.json({
      verwachtVandaag: agg.kerncijfers?.verwachtVandaag ?? 0,
      weekdagCurve: agg.weekdagCurve,
    });
  } catch {
    return NextResponse.json({
      verwachtVandaag: 0,
      weekdagCurve: new Array(24).fill(0),
    });
  }
}
