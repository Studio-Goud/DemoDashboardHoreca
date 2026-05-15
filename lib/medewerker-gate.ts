import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { huidigeSessie } from "./auth";
import { db, schema } from "./db/client";

/**
 * Gate-check voor /m/* pages. Bepaalt waar de medewerker MAG zijn op
 * basis van: ingelogd? onboarding voltooid? goedgekeurd door owner?
 *
 * Retourneert de SessieInfo + status zodat de pagina de naam etc. kan
 * gebruiken. Roept zelf redirect() aan bij wat-mag-niet, dus na deze
 * call ben je gegarandeerd: sessie aanwezig + onboarding compleet +
 * goedgekeurd door owner.
 */
export async function vereistGoedgekeurdeMedewerker() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");

  const [m] = await db.select({
    onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
    goedgekeurd: schema.medewerkers.goedgekeurd,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));

  if (!m) redirect("/m/login");
  if (!m.onboardingVoltooid) redirect("/m/profiel");
  if (!m.goedgekeurd) redirect("/m/wachten");

  return sessie;
}
