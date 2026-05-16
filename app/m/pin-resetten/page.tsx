import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import MedewerkerPinReset from "@/components/medewerker/MedewerkerPinReset";

export const dynamic = "force-dynamic";

export default async function MedewerkerPinResetPagina() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");

  // Niet hier mogen komen als de vlag al gewist is — anders kan iemand
  // 'm onbedoeld opnieuw doen. Stuur dan terug naar het portaal.
  if (!sessie.moetPinResetten) redirect("/m");

  const [m] = await db
    .select({ voornaam: schema.medewerkers.voornaam })
    .from(schema.medewerkers)
    .where(eq(schema.medewerkers.id, sessie.medewerkerId));

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <MedewerkerPinReset voornaam={m?.voornaam ?? sessie.naam.split(" ")[0]} />
    </main>
  );
}
