/**
 * Klant-landing na QR-scan. Verifieert token, registreert "scan"-referral,
 * toont 2 grote knoppen: Google + TripAdvisor. Klik op een knop POST naar
 * /api/r/[token]/click → upgrade naar 'google' of 'tripadvisor' status →
 * redirect naar review-URL.
 *
 * Ingelogde Google/TripAdvisor-sessie op de telefoon zorgt dat het
 * review-form direct opent zonder extra login.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { runAllePendingMigraties } from "@/lib/db/init-sql";
import { verifieerReviewToken } from "@/lib/review-token";
import { ipUitRequest, registreerPoging } from "@/lib/rate-limit";
import ReviewLandingChoice from "@/components/ReviewLandingChoice";

export const dynamic = "force-dynamic";

interface Props {
  params: { token: string };
}

export default async function ReviewLanding({ params }: Props) {
  await runAllePendingMigraties().catch(() => null);
  const verifieerd = verifieerReviewToken(params.token);
  if (!verifieerd) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg, #08090C)" }}>
        <div className="text-center max-w-sm">
          <p className="font-mono text-[10px] tracking-[0.32em] uppercase mb-2" style={{ color: "var(--sf-danger, #FF3D5C)" }}>
            QR verlopen
          </p>
          <p className="text-[14px]" style={{ color: "var(--text, #E8ECF4)" }}>
            Deze QR-code is niet meer geldig. Vraag je medewerker om de QR van vandaag.
          </p>
        </div>
      </main>
    );
  }

  const [m] = await db.select({
    id: schema.medewerkers.id,
    voornaam: schema.medewerkers.voornaam,
    achternaam: schema.medewerkers.achternaam,
    hoofdDepartmentId: schema.medewerkers.hoofdDepartmentId,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, verifieerd.medewerkerId));
  if (!m) notFound();

  // Welk bedrijf? Hoofd-department, of eerste koppeling als fallback.
  let departmentId = m.hoofdDepartmentId;
  if (!departmentId) {
    const [koppeling] = await db.select({ departmentId: schema.medewerkerDepartments.departmentId })
      .from(schema.medewerkerDepartments)
      .where(eq(schema.medewerkerDepartments.medewerkerId, m.id))
      .limit(1);
    departmentId = koppeling?.departmentId ?? null;
  }
  if (!departmentId) notFound();
  const [bedrijf] = await db.select().from(schema.departments).where(eq(schema.departments.id, departmentId));
  if (!bedrijf) notFound();

  // Registreer scan (mits niet rate-limited — voorkomt spam-counters)
  const reqHeaders = headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? reqHeaders.get("x-real-ip")
    ?? "unknown";
  const ipHash = createHash("sha256").update(ip + ":" + verifieerd.medewerkerId).digest("hex").slice(0, 32);
  const ua = (reqHeaders.get("user-agent") ?? "").slice(0, 200);

  // Rate-limit per (medewerker, IP) — max 5 scans/uur om over-tellen tegen te gaan
  const limiet = await registreerPoging(`review-scan:${verifieerd.medewerkerId}:${ipHash}`, 5, 60 * 60);
  if (!limiet.geblokkeerd) {
    await db.insert(schema.reviewReferrals).values({
      medewerkerId: verifieerd.medewerkerId,
      bedrijfSlug: bedrijf.slug,
      datum: verifieerd.datum,
      status: "scan",
      ipHash,
      userAgent: ua,
    });
  }

  return (
    <ReviewLandingChoice
      token={params.token}
      voornaam={m.voornaam}
      bedrijfNaam={bedrijf.naam}
      hex={bedrijf.hex}
      googleUrl={bedrijf.googleReviewUrl ?? ""}
      tripadvisorUrl={bedrijf.tripadvisorReviewUrl ?? ""}
    />
  );
}
