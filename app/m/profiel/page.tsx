import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import MedewerkerProfielFlow from "@/components/medewerker/MedewerkerProfielFlow";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface Props { searchParams: { welkom?: string } }

export default async function MedewerkerProfielPagina({ searchParams }: Props) {
  const sessie = await huidigeSessie();
  if (!sessie) redirect("/m/login");
  if (sessie.moetPinResetten) redirect("/m/pin-resetten");

  // Als onboarding al voltooid is maar nog niet goedgekeurd → naar
  // wachten-pagina (anders blijft 'ie tweaken aan IBAN/BSN nadat owner
  // 'm al heeft beoordeeld). Goedgekeurde medewerkers mogen profiel
  // wel wijzigen voor bv. adreswijziging.
  const [m] = await db.select({
    onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
    goedgekeurd: schema.medewerkers.goedgekeurd,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));
  if (m?.onboardingVoltooid && !m.goedgekeurd) {
    redirect("/m/wachten");
  }

  return <MedewerkerProfielFlow welkom={searchParams.welkom === "1"} />;
}
