import MedewerkerLoginFlow from "@/components/medewerker/MedewerkerLoginFlow";
import TaalSwitcher from "@/components/TaalSwitcher";

export const dynamic = "force-dynamic";

interface Props { searchParams: { email?: string } }

export default function MedewerkerLoginPage({ searchParams }: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <TaalSwitcher />
      </div>
      <MedewerkerLoginFlow ingevuldEmail={searchParams.email ?? ""} />
    </main>
  );
}
