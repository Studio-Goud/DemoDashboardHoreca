import { redirect } from "next/navigation";
import { huidigeSessie } from "@/lib/auth";
import MedewerkerKlok from "@/components/medewerker/MedewerkerKlok";

export const dynamic = "force-dynamic";

export default async function MedewerkerKlokPage() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");
  return <MedewerkerKlok />;
}
