"use client";

import { useState, useEffect, useRef } from "react";
import Icon from "./Icon";
import { useRol, type Rol } from "@/lib/useRol";
import { useT } from "@/lib/i18n/useT";

type IconName = React.ComponentProps<typeof Icon>["name"];

export interface TabDef {
  id: string;
  label: string;          // fallback wanneer tKey niet bestaat
  icon: IconName;
  href?: string;
  roles?: Rol[];
  accent?: string;
  /** Optionele i18n key (bv. "tab.revenue"). */
  tKey?: string;
}

interface Props {
  tabs: TabDef[];
  hex: string;
  children: React.ReactNode[];
}

// Tab-accent kleuren per tab-id — geeft elke tab een eigen "vibe".
// Subtiel: deze worden gemengd met de bedrijfskleur, niet overheersend.
const TAB_ACCENT: Record<string, string> = {
  omzet:     "#0A84FF", // SF blue
  planning:  "#5E5CE6", // SF indigo
  rooster:   "#30B26F", // SF green
  rapporten: "#FFD60A", // SF yellow
  voorraad:  "#FF9F0A", // SF orange
  producten: "#BF5AF2", // SF purple
  inzichten: "#FF453A", // SF red
};

function hashKey(bedrijfHex: string): string {
  return `sg_tab_${bedrijfHex.replace("#", "").toLowerCase()}`;
}

export default function DashboardNav({ tabs, hex, children }: Props) {
  const { rol } = useRol();
  const { t } = useT();

  const labelVan = (tab: TabDef) => tab.tKey ? t(tab.tKey) : tab.label;

  // Tabs filteren op rol
  const zichtbareTabs = tabs.filter((t) => {
    if (!t.roles) return true;
    if (!rol) return true;
    return t.roles.includes(rol);
  });

  // Initiële actieve tab: probeer eerst URL hash, dan sessionStorage,
  // anders eerste content-tab.
  const eersteContent = zichtbareTabs.find((t) => !t.href)?.id ?? zichtbareTabs[0]?.id ?? "";
  const [actief, setActiefState] = useState<string>(eersteContent);
  const navRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Op mount: respect URL hash of sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromHash = window.location.hash.replace(/^#/, "");
    const fromStorage = sessionStorage.getItem(hashKey(hex));
    const target = (fromHash && zichtbareTabs.find((t) => t.id === fromHash && !t.href))
      ? fromHash
      : (fromStorage && zichtbareTabs.find((t) => t.id === fromStorage && !t.href))
        ? fromStorage
        : eersteContent;
    if (target !== actief) setActiefState(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  function setActief(id: string) {
    setActiefState(id);
    if (typeof window === "undefined") return;
    // Bewaar voor terug-navigatie
    sessionStorage.setItem(hashKey(hex), id);
    // Update hash zonder scroll-jump
    history.replaceState(null, "", `#${id}`);
  }

  // Scroll actieve tab in beeld (horizontaal in segmented bar)
  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-tab="${actief}"]`) as HTMLElement;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [actief]);

  const contentTabs = tabs.filter((t) => !t.href);
  const huidigeContentTab = contentTabs.find((t) => t.id === actief);
  const huidigeAccent = (huidigeContentTab?.accent) ?? TAB_ACCENT[actief] ?? hex;

  return (
    <>
      {/* Sticky nav — glassmorphism, hairline border onder, accent-gradient bovenkant */}
      <div
        className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2.5 pb-2 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--bg) 82%, transparent)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        {/* Accent-bar bovenkant — kleurt mee met actieve tab */}
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
          {zichtbareTabs.map((tab) => {
            const isActief = tab.id === actief;
            const tabKleur = tab.accent ?? TAB_ACCENT[tab.id] ?? hex;

            const inner = (
              <>
                <Icon name={tab.icon} size={15} strokeWidth={isActief ? 2.2 : 1.7} />
                <span>{labelVan(tab)}</span>
              </>
            );

            const baseClass = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all shrink-0";

            const activeStyle: React.CSSProperties = isActief
              ? {
                  background: `linear-gradient(135deg, ${tabKleur}22 0%, ${tabKleur}0E 100%)`,
                  color: tabKleur,
                  boxShadow: `inset 0 0 0 1px ${tabKleur}55, 0 2px 10px -2px ${tabKleur}33`,
                }
              : {
                  color: "var(--muted)",
                };

            if (tab.href) {
              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  data-tab={tab.id}
                  role="tab"
                  className={baseClass}
                  style={activeStyle}
                >
                  {inner}
                </a>
              );
            }

            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                role="tab"
                aria-selected={isActief}
                onClick={() => setActief(tab.id)}
                className={baseClass}
                style={activeStyle}
              >
                {inner}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Hero-strip per tab — duidelijke visuele markering welke tab je bekijkt */}
      {huidigeContentTab && (
        <div
          key={actief}
          ref={heroRef}
          className="mt-4 mb-3 rounded-[14px] overflow-hidden fade-up relative"
          style={{
            border: "1px solid var(--hairline)",
            background: `linear-gradient(135deg, ${huidigeAccent}14 0%, ${huidigeAccent}05 60%, var(--bg-elev) 100%)`,
          }}
        >
          {/* Subtiel scan-light effect bij tab-wissel */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px] live-flash"
            style={{ opacity: 0.5 }}
          />
          <div className="flex items-center gap-3 p-3.5">
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] shrink-0"
              style={{
                background: `linear-gradient(135deg, ${huidigeAccent}33 0%, ${huidigeAccent}11 100%)`,
                color: huidigeAccent,
                boxShadow: `inset 0 0 0 1px ${huidigeAccent}55, 0 0 16px -4px ${huidigeAccent}55`,
              }}
            >
              <Icon name={huidigeContentTab.icon} size={20} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p
                className="text-[10px] uppercase tracking-[0.16em] font-semibold"
                style={{ color: huidigeAccent, opacity: 0.85 }}
              >
                Tab
              </p>
              <h2
                className="text-[18px] font-semibold tracking-tight leading-tight"
                style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
              >
                {labelVan(huidigeContentTab)}
              </h2>
            </div>
          </div>
        </div>
      )}

      {/* Tab inhoud */}
      <div className="mt-2">
        {contentTabs.map((tab, idx) => (
          <div
            key={tab.id}
            role="tabpanel"
            className={`space-y-6 ${actief === tab.id ? "block" : "hidden"}`}
          >
            {children[idx]}
          </div>
        ))}
      </div>
    </>
  );
}
