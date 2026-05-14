"use client";

import { useState, useEffect, useRef } from "react";
import Icon from "./Icon";
import TaalPagina from "./TaalPagina";
import TabHero from "./TabHero";
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
  admin:     "#8E8E93", // SF gray
  salaris:   "#00C7BE", // SF teal
  taal:      "#64748b", // neutraal slate
};

// Vaste taal-tab die elke pagina automatisch krijgt — geen per-page wiring.
const TAAL_TAB: TabDef = {
  id: "taal",
  label: "Taal",
  icon: "globe",
  tKey: "tab.language",
};

function hashKey(bedrijfHex: string): string {
  return `sg_tab_${bedrijfHex.replace("#", "").toLowerCase()}`;
}

export default function DashboardNav({ tabs, hex, children }: Props) {
  const { rol } = useRol();
  const { t } = useT();

  const labelVan = (tab: TabDef) => tab.tKey ? t(tab.tKey) : tab.label;

  // Tabs filteren op rol — plus de vaste taal-tab als laatste content-tab.
  const zichtbareTabs = [
    ...tabs.filter((t) => {
      if (!t.roles) return true;
      if (!rol) return true;
      return t.roles.includes(rol);
    }),
    TAAL_TAB,
  ];

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

  // Scroll actieve tab in beeld — alleen ALS hij echt buiten beeld staat.
  // Smooth-scroll is bewust uit: het vocht met user-swipes (touch ←→ smooth
  // animatie), wat de stotter veroorzaakte. Instant scroll = geen conflict.
  useEffect(() => {
    const container = navRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-tab="${actief}"]`) as HTMLElement | null;
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const buiten = eRect.left < cRect.left + 8 || eRect.right > cRect.right - 8;
    if (!buiten) return;
    // Centreer de actieve tab horizontaal in de container (instant, niet smooth).
    container.scrollLeft += eRect.left - cRect.left - (cRect.width - eRect.width) / 2;
  }, [actief]);

  // contentTabs uit zichtbareTabs (inclusief de auto-toegevoegde TAAL_TAB)
  // — niet uit de ruwe `tabs` prop, anders mist taal in de panel-render.
  const contentTabs = zichtbareTabs.filter((t) => !t.href);
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
        <div className="flex items-center gap-2 max-w-full">
        <div
          ref={navRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 min-w-0"
          role="tablist"
          style={{
            // Vertel iOS Safari expliciet: horizontaal pannen is de gesture.
            // Voorkomt dat het systeem 50ms aarzelt tussen tap/scroll/back-swipe.
            touchAction: "pan-x",
            overscrollBehaviorX: "contain",
            WebkitOverflowScrolling: "touch",
          }}
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

      {/* Hero-strip per tab — duidelijke visuele markering welke tab je bekijkt.
          Gedeeld met sub-pages via TabHero zodat het consistent voelt. */}
      {huidigeContentTab && (
        <div key={actief} ref={heroRef}>
          <TabHero
            titel={labelVan(huidigeContentTab)}
            icon={huidigeContentTab.icon}
            accent={huidigeAccent}
          />
        </div>
      )}

      {/* Tab inhoud. Taal-tab heeft eigen built-in content (geen child uit caller). */}
      <div className="mt-2">
        {contentTabs.map((tab, idx) => (
          <div
            key={tab.id}
            role="tabpanel"
            className={`space-y-6 ${actief === tab.id ? "block" : "hidden"}`}
          >
            {tab.id === "taal" ? <TaalPagina /> : children[idx]}
          </div>
        ))}
      </div>
    </>
  );
}
