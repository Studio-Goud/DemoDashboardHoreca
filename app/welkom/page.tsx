import WelkomFlow from "@/components/medewerker/WelkomFlow";
import TaalSwitcher from "@/components/TaalSwitcher";

export const dynamic = "force-dynamic";

interface Props { searchParams: { token?: string } }

export default function WelkomPage({ searchParams }: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <TaalSwitcher />
      </div>
      <WelkomFlow token={searchParams.token ?? ""} />
    </main>
  );
}
