import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import MedewerkerWachten from "@/components/medewerker/MedewerkerWachten";

export const dynamic = "force-dynamic";

export default async function MedewerkerWachtenPagina() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");

  const [m] = await db.select({
    voornaam: schema.medewerkers.voornaam,
    onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
    goedgekeurd: schema.medewerkers.goedgekeurd,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));

  if (!m) redirect("/m/login");
  // Onboarding nog niet af → eerst profiel invullen
  if (!m.onboardingVoltooid) redirect("/m/profiel");
  // Al goedgekeurd → naar het portaal
  if (m.goedgekeurd) redirect("/m");

  return <MedewerkerWachten voornaam={m.voornaam} />;
}
