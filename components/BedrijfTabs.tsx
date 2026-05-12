import Link from "next/link";
import Icon from "./Icon";

interface Props {
  actief: "bb" | "sl" | "kl";
}

const TABS = [
  { slug: "bb" as const, naam: "Brunch & Brew",  icon: "coffee"   as const, accent: "#0A84FF" },
  { slug: "sl" as const, naam: "Saté Lounge",    icon: "utensils" as const, accent: "#30B26F" },
  { slug: "kl" as const, naam: "Kroket Loket",   icon: "store"    as const, accent: "#E07A1F" },
];

export default function BedrijfTabs({ actief }: Props) {
  return (
    <div className="segmented" role="tablist">
      {TABS.map((t) => {
        const isActief = t.slug === actief;
        return (
          <Link
            key={t.slug}
            href={`/${t.slug}`}
            prefetch
            role="tab"
            aria-selected={isActief}
            className="segmented-item"
            style={isActief ? { color: t.accent } : undefined}
          >
            <Icon name={t.icon} size={16} strokeWidth={1.8} />
            <span>{t.naam}</span>
          </Link>
        );
      })}
    </div>
  );
}
