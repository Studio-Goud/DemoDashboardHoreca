import { vereistGoedgekeurdeMedewerker } from "@/lib/medewerker-gate";
import MedewerkerBeschikbaarheid from "@/components/medewerker/MedewerkerBeschikbaarheid";

export const dynamic = "force-dynamic";

export default async function MedewerkerBeschikbaarheidPage() {
  await vereistGoedgekeurdeMedewerker();
  return <MedewerkerBeschikbaarheid />;
}
