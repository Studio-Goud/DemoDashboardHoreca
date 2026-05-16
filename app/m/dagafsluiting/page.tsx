import { redirect } from "next/navigation";
import { huidigeSessie } from "@/lib/auth";
import DagafsluitingForm from "@/components/medewerker/DagafsluitingForm";

export const dynamic = "force-dynamic";

export default async function DagafsluitingPagina() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    redirect("/m/login");
  }
  return <DagafsluitingForm />;
}
