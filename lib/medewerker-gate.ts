import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { huidigeSessie, type SessieInfo } from "./auth";
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

export type ApiGateResultaat =
  | { ok: true; sessie: SessieInfo; goedgekeurd: true }
  | { ok: false; status: number; error: string };

/**
 * API-variant van de gate-check — retourneert een object i.p.v. te
 * redirecten. Gebruik in /api/medewerker/* routes:
 *
 *   const gate = await apiVereistGoedgekeurdeMedewerker();
 *   if (!gate.ok) return NextResponse.json({error: gate.error}, {status: gate.status});
 *
 * `staOnboarding` = true → laat een medewerker die nog onboarding doet
 * toch door (voor profiel- en document-uploads).
 */
export async function apiVereistGoedgekeurdeMedewerker(
  opties: { staOnboarding?: boolean } = {},
): Promise<ApiGateResultaat> {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return { ok: false, status: 401, error: "niet ingelogd" };
  }

  const [m] = await db.select({
    onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
    goedgekeurd: schema.medewerkers.goedgekeurd,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));
  if (!m) {
    return { ok: false, status: 401, error: "medewerker niet gevonden" };
  }

  if (m.goedgekeurd) {
    return { ok: true, sessie, goedgekeurd: true };
  }

  // Niet goedgekeurd: alleen profiel/document-endpoints mogen door
  // tijdens de onboarding (zodat NAW + foto's ingevuld kunnen worden).
  if (opties.staOnboarding && !m.onboardingVoltooid) {
    return { ok: false, status: 403, error: "nog niet goedgekeurd — onboarding eerst" };
    // Note: we returnen niet { ok: true } omdat we apiVereistGoedgekeurd
    // bewust narrow houden. Endpoints die onboarding-toegang willen
    // gebruiken apiSessieOfOnboarding hieronder.
  }
  return { ok: false, status: 403, error: "wacht op goedkeuring door owner" };
}

/**
 * Variant voor profiel + documenten: laat onboardende medewerker door
 * (anders kan 'ie geen NAW/foto's invullen), maar weigert al-actieve
 * medewerker die hun goedkeuring is ingetrokken.
 */
export async function apiSessieVoorOnboarding(): Promise<
  { ok: true; sessie: SessieInfo } | { ok: false; status: number; error: string }
> {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return { ok: false, status: 401, error: "niet ingelogd" };
  }
  return { ok: true, sessie };
}
