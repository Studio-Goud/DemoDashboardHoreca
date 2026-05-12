import WelkomFlow from "@/components/medewerker/WelkomFlow";

export const dynamic = "force-dynamic";

interface Props { searchParams: { token?: string } }

export default function WelkomPage({ searchParams }: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <WelkomFlow token={searchParams.token ?? ""} />
    </main>
  );
}
