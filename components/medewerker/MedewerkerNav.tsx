"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "../Icon";
import TaalSwitcher from "../TaalSwitcher";
import { useT } from "@/lib/i18n/useT";

interface Props {
  naam: string;
  vestiging: string;
}

const TABS = [
  { href: "/m",                 tKey: "tab.schedule",   icon: "calendar-clock" as const },
  { href: "/m/klok",            tKey: "clock.in",       icon: "clock"          as const },
  { href: "/m/beschikbaarheid", tKey: "availability.free", icon: "calendar"    as const },
  { href: "/m/uren",            tKey: "tab.hours",      icon: "wallet"         as const },
];

const VESTIGING_NAAM: Record<string, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

const VESTIGING_HEX: Record<string, string> = {
  bb: "#0A84FF", sl: "#30B26F", kl: "#E07A1F",
};

export default function MedewerkerNav({ naam, vestiging }: Props) {
  const pad = usePathname();
  const router = useRouter();
  const { t } = useT();
  const hex = VESTIGING_HEX[vestiging] ?? "#0A84FF";

  async function uitloggen() {
    await fetch("/api/medewerker/uitloggen", { method: "POST" });
    router.replace("/m/login");
  }

  return (
    <>
      {/* Top-bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--bg-elev) 88%, transparent)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="eyebrow" style={{ color: hex }}>{VESTIGING_NAAM[vestiging] ?? vestiging}</p>
            <p className="text-[15px] font-semibold truncate" style={{ color: "var(--text)" }}>
              {t("m.hello")}, {naam.split(" ")[0]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TaalSwitcher compact />
            <button
              onClick={uitloggen}
              className="text-[12px] flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ color: "var(--muted)" }}
              aria-label="Uitloggen"
            >
              <Icon name="log-out" size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Onderaan: tab-bar (mobiel-first) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--bg-elev) 88%, transparent)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div className="max-w-md mx-auto grid grid-cols-4">
          {TABS.map((tab) => {
            const actief = pad === tab.href || (tab.href !== "/m" && pad.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-0.5 py-2.5 transition-colors"
                style={{ color: actief ? hex : "var(--muted)" }}
              >
                <Icon name={tab.icon} size={20} strokeWidth={actief ? 2 : 1.6} />
                <span className="text-[10px] font-medium" style={{ letterSpacing: "-0.005em" }}>
                  {t(tab.tKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
