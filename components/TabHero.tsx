"use client";

import Icon from "@/components/Icon";

type IconName = React.ComponentProps<typeof Icon>["name"];

interface Props {
  /** Korte label boven de titel — meestal "Tab" of een sectie-naam. */
  eyebrow?: string;
  /** Hoofdtitel — "Omzet", "Voorraad", "Rooster", etc. */
  titel: string;
  /** Icoon links in het gekleurde vierkant. */
  icon: IconName;
  /** Accent-kleur die door de gradient + glow loopt. */
  accent: string;
}

/**
 * Hero-strip die elke (sub-)pagina opent met een duidelijke H1-achtige
 * visuele markering. Identiek aan de hero die DashboardNav bovenaan
 * elke content-tab rendert — gebruikt door rooster/voorraad/rapporten
 * sub-pages zodat die niet meer "gestript" voelen.
 */
export default function TabHero({ eyebrow = "Tab", titel, icon, accent }: Props) {
  return (
    <div
      className="mt-4 mb-3 rounded-[14px] overflow-hidden fade-up relative"
      style={{
        border: "1px solid var(--hairline)",
        background: `linear-gradient(135deg, ${accent}14 0%, ${accent}05 60%, var(--bg-elev) 100%)`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[1px] live-flash"
        style={{ opacity: 0.5 }}
      />
      <div className="flex items-center gap-3 p-3.5">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] shrink-0"
          style={{
            background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 100%)`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}55, 0 0 16px -4px ${accent}55`,
          }}
        >
          <Icon name={icon} size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase tracking-[0.16em] font-semibold"
            style={{ color: accent, opacity: 0.85 }}
          >
            {eyebrow}
          </p>
          <h2
            className="text-[18px] font-semibold tracking-tight leading-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.019em" }}
          >
            {titel}
          </h2>
        </div>
      </div>
    </div>
  );
}
