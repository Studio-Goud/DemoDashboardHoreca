"use client";

/**
 * Floating bottom tab-bar — glassmorphism, niet plakkerig aan onderkant.
 * Actieve tab krijgt glow + accent-tint. 44pt tap targets gegarandeerd.
 *
 * Geen direct linkjes-gebruik — caller bepaalt zelf welke link/anchor
 * 'ie wil (Next Link of native).
 */
import { motion } from "framer-motion";
import { tap as tapPreset } from "@/lib/motion";

export interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  tabs: TabItem[];
  actiefId: string;
  onSelect: (id: string) => void;
}

export default function TabBar({ tabs, actiefId, onSelect }: Props) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 pb-[env(safe-area-inset-bottom)]"
      role="tablist"
      aria-label="Hoofd-navigatie"
    >
      <div className="max-w-md mx-auto px-3 pb-3">
        <div
          className="flex items-center gap-1 p-1 backdrop-blur-sf-strong rounded-sf-lg"
          style={{
            background: "var(--sf-bg-overlay)",
            border: "1px solid var(--sf-hairline)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {tabs.map((tab) => {
            const actief = tab.id === actiefId;
            return (
              <motion.button
                key={tab.id}
                role="tab"
                aria-selected={actief}
                aria-label={tab.label}
                onClick={() => onSelect(tab.id)}
                whileTap={{ scale: 0.96 }}
                transition={tapPreset.transition}
                className="relative flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-sf font-display transition-colors"
                style={{
                  color: actief ? "var(--sf-accent)" : "var(--sf-fg-muted)",
                  background: actief ? "var(--sf-accent-edge, rgba(0,229,255,0.10))" : "transparent",
                  boxShadow: actief ? "0 0 16px var(--sf-accent-glow)" : "none",
                }}
              >
                {tab.icon}
                <span className="text-[10px] tracking-wide">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
