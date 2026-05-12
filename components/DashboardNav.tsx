"use client";

import { useState, useEffect, useRef } from "react";
import Icon from "./Icon";

type IconName = React.ComponentProps<typeof Icon>["name"];

export interface TabDef {
  id: string;
  label: string;
  icon: IconName;
  href?: string;
}

interface Props {
  tabs: TabDef[];
  hex: string;
  children: React.ReactNode[];
}

export default function DashboardNav({ tabs, hex, children }: Props) {
  const [actief, setActief] = useState(
    tabs.find((t) => !t.href)?.id ?? tabs[0]?.id ?? "",
  );
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-tab="${actief}"]`) as HTMLElement;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [actief]);

  const contentTabs = tabs.filter((t) => !t.href);

  return (
    <>
      {/* Sticky nav — glassmorphism, hairline border onder */}
      <div
        className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--bg) 78%, transparent)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div
          ref={navRef}
          className="segmented overflow-x-auto scrollbar-hide max-w-full"
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActief = tab.id === actief;
            const activeStyle = isActief ? { color: hex } : undefined;

            const inner = (
              <>
                <Icon name={tab.icon} size={15} strokeWidth={1.8} />
                <span>{tab.label}</span>
              </>
            );

            if (tab.href) {
              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  data-tab={tab.id}
                  role="tab"
                  className="segmented-item"
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
                className="segmented-item"
                style={activeStyle}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
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
