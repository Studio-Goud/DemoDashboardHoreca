import TabHero from "@/components/TabHero";

export default function RapportenLoading() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="h-12 mb-2" />
      <TabHero titel="Uren" icon="wallet" accent="#FFD60A" />
      <div className="space-y-3">
        <div className="h-32 rounded-[14px] bg-slate-50 animate-pulse" />
        <div className="h-60 rounded-[14px] bg-slate-50 animate-pulse" />
      </div>
    </main>
  );
}
