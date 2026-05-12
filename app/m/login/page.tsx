import MedewerkerLoginFlow from "@/components/medewerker/MedewerkerLoginFlow";

export const dynamic = "force-dynamic";

interface Props { searchParams: { email?: string } }

export default function MedewerkerLoginPage({ searchParams }: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <MedewerkerLoginFlow ingevuldEmail={searchParams.email ?? ""} />
    </main>
  );
}
