import { redirect } from "next/navigation";
import { huidigeSessie } from "@/lib/auth";
import MedewerkerBeschikbaarheid from "@/components/medewerker/MedewerkerBeschikbaarheid";

export const dynamic = "force-dynamic";

export default async function MedewerkerBeschikbaarheidPage() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");
  return <MedewerkerBeschikbaarheid />;
}
