/**
 * GET /api/m/mijn-score
 * → { perBedrijf: Array<{ bedrijfSlug, bedrijfNaam, hex, rang, totaal, score: ScoreRij | null }> }
 *
 * Eigen positie van de ingelogde medewerker per bedrijf waar ze
 * gekoppeld zijn. Toont rang + score + de bovenliggende kandidaat
 * (om te motiveren), maar nooit details van anderen.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiVereistGoedgekeurdeMedewerker } from "@/lib/medewerker-gate";
import { db, schema } from "@/lib/db/client";
import { berekenLeaderboard } from "@/lib/medewerker-score";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await apiVereistGoedgekeurdeMedewerker();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const koppelingen = await db
    .select({
      slug: schema.departments.slug,
      naam: schema.departments.naam,
      hex: schema.departments.hex,
    })
    .from(schema.medewerkerDepartments)
    .innerJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
    .where(eq(schema.medewerkerDepartments.medewerkerId, gate.sessie.medewerkerId));

  const perBedrijf = await Promise.all(koppelingen.map(async (b) => {
    const rijen = await berekenLeaderboard({ bedrijfSlug: b.slug, venster: 30 });
    const mijn = rijen.find((r) => r.medewerkerId === gate.sessie.medewerkerId) ?? null;
    const bovenMij = mijn && mijn.rang > 1
      ? rijen.find((r) => r.rang === mijn.rang - 1) ?? null
      : null;
    return {
      bedrijfSlug: b.slug,
      bedrijfNaam: b.naam,
      hex: b.hex,
      totaalDeelnemers: rijen.length,
      score: mijn,
      bovenMij: bovenMij ? { rang: bovenMij.rang, voornaam: bovenMij.voornaam, totaalScore: bovenMij.totaalScore } : null,
    };
  }));

  return NextResponse.json({ perBedrijf });
}
