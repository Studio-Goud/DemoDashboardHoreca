"use client";

import Link from "next/link";
import { useRef, useEffect } from "react";
import Icon from "./Icon";
import { useRol, type Rol } from "@/lib/useRol";
import { useT } from "@/lib/i18n/useT";
import TaalSwitcher from "./TaalSwitcher";

type IconName = React.ComponentProps<typeof Icon>["name"];

export interface TabEntry {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  roles?: Rol[];
  accent?: string;
}

// Zelfde palette als in DashboardNav
const TAB_ACCENT: Record<string, string> = {
  omzet:     "#0A84FF",
  planning:  "#5E5CE6",
  rooster:   "#30B26F",
  rapporten: "#FFD60A",
  voorraad:  "#FF9F0A",
  producten: "#BF5AF2",
  inzichten: "#FF453A",
  admin:     "#8E8E93",
};

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  /** ID van de tab die als actief getoond moet worden (huidige pagina). */
  actiefId: string;
}

/**
 * Tab-bar voor sub-pages binnen een bedrijfsdashboard (rooster, voorraad,
 * rapporten). Gedraagt zich identiek als de TabBar op /[bedrijf], maar
 * navigeert via <Link> i.p.v. tabpanels — zo voelt switchen vloeiend.
 */
export default function BedrijfTabBar({ bedrijf, actiefId }: Props) {
  const { rol } = useRol();
  const { t } = useT();
  const navRef = useRef<HTMLDivElement>(null);

  const tabs: TabEntry[] = [
    { id: "omzet",     label: t("tab.revenue"),   icon: "trending-up",   href: `/${bedrijf}`            },
    { id: "planning",  label: t("tab.planning"),  icon: "calendar",      href: `/${bedrijf}#planning`   },
    { id: "rooster",   label: t("tab.schedule"),  icon: "calendar-clock", href: `/${bedrijf}/rooster`    },
    { id: "rapporten", label: t("tab.hours"),     icon: "wallet",        href: `/${bedrijf}/rapporten`  },
    { id: "voorraad",  label: t("tab.inventory"), icon: "shopping-bag",  href: `/${bedrijf}/voorraad`   },
    { id: "producten", label: t("tab.products"),  icon: "shopping-bag",  href: `/${bedrijf}#producten`  },
    { id: "inzichten", label: t("tab.insights"),  icon: "lightbulb",     href: `/${bedrijf}#inzichten`  },
    {
      id: "admin", label: t("tab.admin"), icon: "clipboard",
      href: `/administratie/${bedrijf}`, roles: ["owner"],
    },
  ];

  const zichtbaar = tabs.filter((t) => {
    if (!t.roles) return true;
    if (!rol) return true;
    return t.roles.includes(rol);
  });

  // Scroll actieve tab in beeld
  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-tab="${actiefId}"]`) as HTMLElement;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [actiefId]);

  const huidigeAccent = TAB_ACCENT[actiefId] ?? "#0A84FF";

  return (
    <div
      className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2.5 pb-2 backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--bg) 82%, transparent)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-500"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${huidigeAccent}cc 50%, transparent 100%)`,
          opacity: 0.85,
        }}
      />
      <div className="flex items-center gap-2 max-w-full">
      <div
        ref={navRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 min-w-0"
        role="tablist"
      >
        {zichtbaar.map((tab) => {
          const isActief = tab.id === actiefId;
          const tabKleur = tab.accent ?? TAB_ACCENT[tab.id] ?? "#0A84FF";

          return (
            <Link
              key={tab.id}
              href={tab.href}
              data-tab={tab.id}
              role="tab"
              aria-selected={isActief}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all shrink-0"
              style={isActief
                ? {
                    background: `linear-gradient(135deg, ${tabKleur}22 0%, ${tabKleur}0E 100%)`,
                    color: tabKleur,
                    boxShadow: `inset 0 0 0 1px ${tabKleur}55, 0 2px 10px -2px ${tabKleur}33`,
                  }
                : { color: "var(--muted)" }}
            >
              <Icon name={tab.icon} size={15} strokeWidth={isActief ? 2.2 : 1.7} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="shrink-0 pl-1">
        <TaalSwitcher />
      </div>
      </div>
    </div>
  );
}
