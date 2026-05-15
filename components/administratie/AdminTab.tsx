"use client";

import { useEffect, useState } from "react";
import IngUpload from "@/components/administratie/IngUpload";
import FacturenPanel from "@/components/administratie/FacturenPanel";
import ContantInvoer from "@/components/administratie/ContantInvoer";
import MaandPnL from "@/components/administratie/MaandPnL";
import KwartaalRapport from "@/components/administratie/KwartaalRapport";
import ReviewPanel from "@/components/administratie/ReviewPanel";
import SetupPanel from "@/components/administratie/SetupPanel";
import DgaEnergiePanel from "@/components/administratie/DgaEnergiePanel";
import CashflowProjectie from "@/components/administratie/CashflowProjectie";
import MedewerkerDocumentenPanel from "@/components/administratie/MedewerkerDocumentenPanel";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

/**
 * Admin-tab inhoud — alle administratie-panels in één component zodat ze
 * inline in de DashboardNav-tab gerenderd kunnen worden ipv via een
 * aparte route (/administratie/[bedrijf]).
 */
export default function AdminTab({ bedrijf, hex }: Props) {
  const nu = new Date();
  const jaar = nu.getFullYear();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refresh = () => setRefreshTrigger((n) => n + 1);

  return (
    <div className="space-y-5">
      <MaandPnL bedrijf={bedrijf} hex={hex} key={`pnl-${refreshTrigger}`} />
      <CashflowProjectie bedrijf={bedrijf} hex={hex} />
      <DgaEnergiePanel bedrijf={bedrijf} hex={hex} />
      <IngUpload bedrijf={bedrijf} hex={hex} onSuccess={refresh} />
      <ReviewPanel bedrijf={bedrijf} hex={hex} jaar={jaar} key={`review-${refreshTrigger}`} />
      <FacturenPanel bedrijf={bedrijf} hex={hex} jaar={jaar} />
      <ContantInvoer bedrijf={bedrijf} hex={hex} jaar={jaar} onWijziging={refresh} />
      <KwartaalRapport bedrijf={bedrijf} hex={hex} />
      <MedewerkerDocumentenPanel hex={hex} />
      <SetupPanel hex={hex} />
    </div>
  );
}
