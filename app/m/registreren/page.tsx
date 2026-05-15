import MedewerkerRegistratieFlow from "@/components/medewerker/MedewerkerRegistratieFlow";
import TaalSwitcher from "@/components/TaalSwitcher";

export const dynamic = "force-dynamic";

export default function MedewerkerRegistratiePagina() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <TaalSwitcher />
      </div>
      <MedewerkerRegistratieFlow />
    </main>
  );
}
