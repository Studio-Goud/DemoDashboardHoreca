import MedewerkerLoginFlow from "@/components/medewerker/MedewerkerLoginFlow";
import TaalSwitcher from "@/components/TaalSwitcher";
import { redirect } from "next/navigation";
import { huidigeSessie } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Props { searchParams: { email?: string } }

export default async function MedewerkerLoginPage({ searchParams }: Props) {
  // Al een actieve medewerker-sessie? Direct naar het portaal — voorkomt
  // dat een ingelogde gebruiker per ongeluk weer in het login-formulier
  // belandt (of dat een nieuwe sollicitant restjes van een vorige sessie ziet).
  const sessie = await huidigeSessie();
  if (sessie && sessie.rol === "medewerker") {
    redirect("/m");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <TaalSwitcher />
      </div>
      <MedewerkerLoginFlow ingevuldEmail={searchParams.email ?? ""} />
    </main>
  );
}
