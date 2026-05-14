"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { useTaal } from "@/lib/i18n/TaalProvider";

interface KritiekItem {
  id: string;
  naam: string;
  aantal: number;
  eenheid: string;
  niveau: "op" | "kritiek" | "laag" | "vol";
  kritiekProduct: boolean;
}

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

export default function VoorraadAlerts({ bedrijf, hex }: Props) {
  const { t } = useTaal();
  const [items, setItems] = useState<KritiekItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function laden() {
      try {
        const res = await fetch(`/api/voorraad/${bedrijf}`, { cache: "no-store" });
        if (res.ok && mounted) {
          const j = (await res.json()) as { producten: KritiekItem[] };
          setItems(j.producten.filter((p) => p.niveau !== "vol"));
        }
      } catch {
        // stil
      } finally {
        if (mounted) setLoading(false);
      }
    }
    laden();
    const id = setInterval(laden, 60_000);
    return () => { mounted = false; clearInterval(id); };
  }, [bedrijf]);

  if (loading) return null;
  if (items.length === 0) return null;

  const kritiek = items.filter((i) => i.kritiekProduct && (i.niveau === "op" || i.niveau === "kritiek"));
  const heeftDirecteAlert = kritiek.length > 0;

  return (
    <Link
      href={`/${bedrijf}/voorraad`}
      className={`card block transition-all ${heeftDirecteAlert ? "breathe-critical" : ""}`}
      style={{
        background: heeftDirecteAlert ? "rgba(229,72,77,0.06)" : "var(--bg-elev)",
        borderColor: heeftDirecteAlert ? "rgba(229,72,77,0.4)" : `${hex}33`,
        color: heeftDirecteAlert ? "#E5484D" : "var(--text)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: heeftDirecteAlert ? "#E5484D" : hex }} className="shrink-0">
            <Icon name={heeftDirecteAlert ? "alert" : "shopping-bag"} size={18} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow" style={{ color: heeftDirecteAlert ? "#E5484D" : "var(--muted)" }}>
              {heeftDirecteAlert ? t("voorraad.order_alert") : t("voorraad.order_list_alt")}
            </p>
            <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text)" }}>
              {heeftDirecteAlert
                ? kritiek.slice(0, 3).map((k) => k.naam).join(" · ")
                  + (kritiek.length > 3 ? ` +${kritiek.length - 3}` : "")
                : `${items.length} ${t("voorraad.order_count")}`}
            </p>
          </div>
        </div>
        <Icon name="chevron-right" size={18} className="opacity-50 shrink-0" />
      </div>
    </Link>
  );
}
