"use client";

import TaalSwitcher from "./TaalSwitcher";

/**
 * Drijvende taal-switcher in de hoek rechtsonder. Subtiel, altijd bereikbaar,
 * concurreert niet met de tab-bar bovenin. Respecteert iOS safe-area zodat
 * hij niet onder de home-indicator verdwijnt.
 */
export default function TaalFloater() {
  return (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      aria-hidden={false}
    >
      <div className="pointer-events-auto opacity-70 hover:opacity-100 transition-opacity">
        <TaalSwitcher compact />
      </div>
    </div>
  );
}
