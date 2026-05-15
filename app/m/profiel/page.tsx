import { redirect } from "next/navigation";
import MedewerkerProfielFlow from "@/components/medewerker/MedewerkerProfielFlow";
import { huidigeSessie } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Props { searchParams: { welkom?: string } }

export default async function MedewerkerProfielPagina({ searchParams }: Props) {
  const sessie = await huidigeSessie();
  if (!sessie) redirect("/m/login");
  return <MedewerkerProfielFlow welkom={searchParams.welkom === "1"} />;
}
