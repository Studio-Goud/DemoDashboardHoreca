"use client";

import { useState, useEffect, useRef } from "react";

export interface TabDef {
  id: string;
  label: string;
  emoji: string;
}

interface Props {
  tabs: TabDef[];
  hex: string;
  children: React.ReactNode[];
}

export default function DashboardNav({ tabs, hex, children }: Props) {
  const [actief, setActief] = useState(tabs[0]?.id ?? "");
  const navRef = useRef<HTMLDivElement>(null);

  // Scroll actieve tab in beeld op mobiel
  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-tab="${actief}"]`) as HTMLElement;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [actief]);

  return (
    <>
      {/* Sticky tab-balk */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div
          ref={navRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5"
        >
          {tabs.map((tab) => {
            const isActief = tab.id === actief;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setActief(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0"
                style={
                  isActief
                    ? { backgroundColor: hex + "18", color: hex, boxShadow: `inset 0 0 0 1.5px ${hex}55` }
                    : { color: "#64748B" }
                }
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab inhoud */}
      <div className="mt-4">
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={`space-y-6 ${actief === tab.id ? "block" : "hidden"}`}
          >
            {children[idx]}
          </div>
        ))}
      </div>
    </>
  );
}
