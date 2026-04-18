import DashboardSkeleton from "@/components/DashboardSkeleton";

export default function Loading() {
  // Neutrale hex tijdens navigatie — de echte kleur komt bij data
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="h-12 mb-6" />
      <DashboardSkeleton hex="#94A3B8" />
    </main>
  );
}
