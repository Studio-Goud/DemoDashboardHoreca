import { vereistGoedgekeurdeMedewerker } from "@/lib/medewerker-gate";
import MedewerkerKlok from "@/components/medewerker/MedewerkerKlok";

export const dynamic = "force-dynamic";

export default async function MedewerkerKlokPage() {
  await vereistGoedgekeurdeMedewerker();
  return <MedewerkerKlok />;
}
