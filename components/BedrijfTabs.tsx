import Link from "next/link";

interface Props {
  actief: "bb" | "sl" | "kl";
}

const TABS = [
  {
    slug: "bb" as const,
    naam: "Brunch & Brew",
    emoji: "☕",
    primary: "#00B8FF",
    soft: "#E0F4FF",
  },
  {
    slug: "sl" as const,
    naam: "Saté Lounge",
    emoji: "🍢",
    primary: "#00D27A",
    soft: "#DAFBE9",
  },
  {
    slug: "kl" as const,
    naam: "Kroket Loket",
    emoji: "🥟",
    primary: "#FF8A00",
    soft: "#FFEDD5",
  },
];

export default function BedrijfTabs({ actief }: Props) {
  return (
    <div className="inline-flex rounded-full bg-white border border-slate-200 p-1 shadow-card">
      {TABS.map((t) => {
        const isActief = t.slug === actief;
        return (
          <Link
            key={t.slug}
            href={`/${t.slug}`}
            prefetch
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
            style={
              isActief
                ? {
                    backgroundColor: t.soft,
                    color: t.primary,
                    boxShadow: `0 0 0 1px ${t.primary}55, 0 0 18px -4px ${t.primary}88`,
                  }
                : { color: "#64748B" }
            }
          >
            <span className="text-base">{t.emoji}</span>
            <span>{t.naam}</span>
          </Link>
        );
      })}
    </div>
  );
}
