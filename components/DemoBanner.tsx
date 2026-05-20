"use client";

export default function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-4 text-sm font-semibold shadow-md">
      🎯 DEMO — fictieve data · inloggen met PIN{" "}
      <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">1111</span>
      {" "}(owner) of{" "}
      <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">2222</span>
      {" "}(manager)
    </div>
  );
}
