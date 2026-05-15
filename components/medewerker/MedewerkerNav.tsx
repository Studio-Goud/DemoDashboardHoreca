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

  // Verberg de nav op login- en registratie-routes, ook als de gebruiker
  // nog een oude sessie heeft. Dat voorkomt dat een nieuwe sollicitant op
  // /m/registreren plotseling de rooster-knoppen van een vorige sessie ziet.
  if (pad?.startsWith("/m/login") || pad?.startsWith("/m/registreren")) {
    return null;
  }

  const hex = VESTIGING_HEX[vestiging] ?? "#0A84FF";

  async function uitloggen() {
    try {
      const res = await fetch("/api/medewerker/uitloggen", { method: "POST" });
      if (!res.ok) console.warn("[uitloggen] response not ok", res.status);
    } catch (e) {
      console.warn("[uitloggen] fetch failed", e);
    } finally {
      // Hard navigatie zodat de server-side sessie-check op /m/login
      // herstart met de gewiste cookie. router.replace blijft soms hangen
      // op de huidige client-state als de PWA agressief cachet.
      window.location.href = "/m/login";
    }
  }

  return (
    <>
      {/* Top-bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--bg-elev) 88%, transparent)",
          borderBottom: "1px solid var(--hairline)",
          paddingTop: "env(safe-area-inset-top)",
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
              className="text-[12px] font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{
                color: "var(--text-2)",
                background: "var(--bg-elev)",
                border: "1px solid var(--hairline)",
              }}
              aria-label={t("m.logout")}
            >
              <Icon name="log-out" size={14} />
              <span>{t("m.logout")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Onderaan: tab-bar (mobiel-first) — groter en met safe-area-inset
          zodat 'ie boven de iPhone home-indicator zit */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--bg-elev) 92%, transparent)",
          borderTop: "1px solid var(--hairline)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="max-w-md mx-auto grid grid-cols-4">
          {TABS.map((tab) => {
            const actief = pad === tab.href || (tab.href !== "/m" && pad.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-1 py-4 transition-colors"
                style={{ color: actief ? hex : "var(--muted)" }}
              >
                <Icon name={tab.icon} size={26} strokeWidth={actief ? 2 : 1.6} />
                <span className="text-[11px] font-medium" style={{ letterSpacing: "-0.005em" }}>
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
