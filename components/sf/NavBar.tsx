"use client";

/**
 * Sticky top navigation-bar met glassmorphism + safe-area-inset-top.
 * Drie slots: leading | center | trailing.
 */
interface Props {
  leading?: React.ReactNode;
  center?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Default: sticky. Op `relative` voor inline gebruik. */
  position?: "sticky" | "relative";
}

export default function NavBar({ leading, center, trailing, position = "sticky" }: Props) {
  return (
    <header
      className={`${position} top-0 z-30 backdrop-blur-sf`}
      style={{
        background: "var(--sf-glass-strong, rgba(255,255,255,0.06))",
        borderBottom: "1px solid var(--sf-hairline)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 h-12">
        <div className="flex-1 flex items-center justify-start min-w-0">{leading}</div>
        <div className="flex-none">{center}</div>
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">{trailing}</div>
      </div>
    </header>
  );
}
