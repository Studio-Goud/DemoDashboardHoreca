import MedewerkerRegistratieFlow from "@/components/medewerker/MedewerkerRegistratieFlow";
import TaalSwitcher from "@/components/TaalSwitcher";
import { redirect } from "next/navigation";
import { huidigeSessie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MedewerkerRegistratiePagina() {
  // Iemand die al ingelogd is moet eerst uitloggen voordat 'ie een nieuw
  // account kan aanmaken. Direct naar /m sturen voorkomt dat de
  // registratieflow gestart wordt onder iemand anders' sessie.
  const sessie = await huidigeSessie();
  if (sessie && sessie.rol === "medewerker") {
    redirect("/m");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <TaalSwitcher />
      </div>
      <MedewerkerRegistratieFlow />
    </main>
  );
}
