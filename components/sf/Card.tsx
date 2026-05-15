"use client";

/**
 * Card-container met layered depth: glass background + hairline border
 * + subtiele inner-top highlight. Optionele accent-strip bovenaan voor
 * categorisatie.
 *
 * Drie varianten:
 * - default: glass + hairline (voor meeste content)
 * - solid: surface bg (voor info-dichte content)
 * - elevated: overlay-tint met sterkere shadow (voor modals/heroes)
 */
interface Props {
  variant?: "default" | "solid" | "elevated";
  /** Toon dunne accent-lijn aan top (categorisatie). */
  accent?: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function Card({ variant = "default", accent, className = "", children }: Props) {
  const variantStyles = {
    default: {
      background: "var(--sf-glass)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
    },
    solid: {
      background: "var(--sf-bg-surface)",
    },
    elevated: {
      background: "var(--sf-bg-elevated)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
    },
  };

  return (
    <div
      className={`relative rounded-sf-lg ${className}`}
      style={{
        ...variantStyles[variant],
        border: "1px solid var(--sf-hairline)",
      }}
    >
      {/* Subtiele inner-top highlight — fakes refractief glass-effect */}
      {variant !== "elevated" && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px rounded-t-sf-lg"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }}
        />
      )}
      {/* Accent strip — voor categorisatie */}
      {accent && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-sf-lg"
          style={{
            background: "linear-gradient(90deg, transparent, var(--sf-accent), transparent)",
            boxShadow: "0 0 12px var(--sf-accent-glow)",
          }}
        />
      )}
      {children}
    </div>
  );
}
