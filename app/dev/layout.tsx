/**
 * Layout voor de design-system / boot-sequence demo-routes. Geen
 * PinGate, geen LiveBalk — clean canvas zodat we de hero-effecten
 * kunnen presenteren zonder dat de echte app er omheen flikkert.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--sf-bg)", color: "var(--sf-fg)" }}>
      {children}
    </div>
  );
}
