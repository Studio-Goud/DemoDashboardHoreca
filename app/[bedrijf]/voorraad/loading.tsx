import TabHero from "@/components/TabHero";

export default function VoorraadLoading() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="h-12 mb-2" />
      <TabHero titel="Voorraad" icon="shopping-bag" accent="#FF9F0A" />
      <div className="space-y-3">
        <div className="h-20 rounded-[14px] bg-slate-50 animate-pulse" />
        <div className="h-40 rounded-[14px] bg-slate-50 animate-pulse" />
        <div className="h-40 rounded-[14px] bg-slate-50 animate-pulse" />
      </div>
    </main>
  );
}
