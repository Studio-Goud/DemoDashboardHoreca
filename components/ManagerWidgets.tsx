"use client";

import { useRol } from "@/lib/useRol";
import ManagerLeaderboard from "./ManagerLeaderboard";
import ManagerDoelTracker from "./ManagerDoelTracker";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

/**
 * Wrapper die alleen rendert wanneer de huidige gebruiker rol="manager" heeft.
 * Toont leaderboard + doel-tracker bovenaan het manager-dashboard.
 */
export default function ManagerWidgets({ bedrijf, hex }: Props) {
  const { rol } = useRol();
  if (rol !== "manager") return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
      <ManagerLeaderboard eigen={bedrijf} />
      <ManagerDoelTracker eigen={bedrijf} hex={hex} />
    </div>
  );
}
