import TabHero from "@/components/TabHero";

/**
 * Instant skeleton tijdens server-side data laden (medewerkers, shifts,
 * beschikbaarheid, weer, cruises, feestdagen). Zonder loading.tsx zag de
 * gebruiker een "doorbleeding" naar de vorige pagina — nu krijgt-ie direct
 * de hero + skeleton-blokken.
 */
export default function RoosterLoading() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="h-12 mb-2" />
      <TabHero titel="Rooster" icon="calendar-clock" accent="#30B26F" />
      <div className="space-y-3">
        <div className="h-32 rounded-[14px] bg-slate-50 animate-pulse" />
        <div className="h-72 rounded-[14px] bg-slate-50 animate-pulse" />
        <div className="h-72 rounded-[14px] bg-slate-50 animate-pulse" />
      </div>
    </main>
  );
}
