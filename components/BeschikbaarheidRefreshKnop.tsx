"use client";

/**
 * Knop die Shiftbase-beschikbaarheid synct naar onze DB en de pagina
 * opnieuw laadt. Toont een diagnose-paneel na de sync zodat de manager
 * direct ziet of er data binnenkwam, en zo niet — waarom (bv. medewerker
 * niet aan Shiftbase-id gekoppeld).
 *
 * Verdwijnt zodra medewerkers volledig via /m/beschikbaarheid werken.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

interface Props { hex: string }

interface SyncResult {
  opgehaald: number;
  nieuw: number;
  bijgewerkt: number;
  overgeslagenOnbekend: number;
  overgeslagenGeenKoppeling: number;
  ongekoppeldeShiftbaseIds: string[];
  errors: string[];
}

export default function BeschikbaarheidRefreshKnop({ hex }: Props) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function refresh() {
    setBezig(true);
    try {
      const res = await fetch("/api/shiftbase/refresh-beschikbaarheid", { method: "POST" });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Rustig aan — even wachten.");
        return;
      }
      if (!res.ok) {
        alert("Refresh mislukt.");
        return;
      }
      const j = await res.json() as SyncResult;
      setResult(j);
      router.refresh();
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={refresh}
        disabled={bezig}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
        style={{
          background: "var(--bg-elev)",
          border: `1px solid ${hex}`,
          color: hex,
        }}
        title="Beschikbaarheid uit Shiftbase opnieuw ophalen"
      >
        <Icon name="refresh" size={13} className={bezig ? "animate-spin" : ""} />
        <span>{bezig ? "Bezig…" : "Beschikbaarheid sync"}</span>
      </button>

      {result && !bezig && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl p-3 z-10 shadow-lg"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
              Sync-resultaat
            </p>
            <button
              onClick={() => setResult(null)}
              className="text-[14px] leading-none"
              style={{ color: "var(--muted)" }}
            >
              ×
            </button>
          </div>
          <ul className="space-y-1 text-[11px]" style={{ color: "var(--text-2)" }}>
            <li>📥 {result.opgehaald} records uit Shiftbase</li>
            {result.nieuw > 0 && (
              <li style={{ color: "#30B26F" }}>✓ {result.nieuw} nieuw opgeslagen</li>
            )}
            {result.bijgewerkt > 0 && (
              <li style={{ color: "#0A84FF" }}>↻ {result.bijgewerkt} bijgewerkt</li>
            )}
            {result.overgeslagenOnbekend > 0 && (
              <li style={{ color: "var(--muted)" }}>
                – {result.overgeslagenOnbekend} zonder invoer (skip)
              </li>
            )}
            {result.overgeslagenGeenKoppeling > 0 && (
              <li style={{ color: "#E5484D" }}>
                ⚠ {result.overgeslagenGeenKoppeling} records — medewerker niet gekoppeld
              </li>
            )}
            {result.errors.length > 0 && (
              <li style={{ color: "#E5484D" }}>
                ✗ Fout: {result.errors.join("; ")}
              </li>
            )}
          </ul>
          {result.ongekoppeldeShiftbaseIds.length > 0 && (
            <p className="text-[10px] mt-2 pt-2" style={{ color: "var(--muted)", borderTop: "1px solid var(--hairline)" }}>
              Shiftbase user-ids zonder match: {result.ongekoppeldeShiftbaseIds.slice(0, 5).join(", ")}
              {result.ongekoppeldeShiftbaseIds.length > 5 && ` +${result.ongekoppeldeShiftbaseIds.length - 5} meer`}
              . Draai admin → "Shiftbase historie-sync" om medewerkers te koppelen.
            </p>
          )}
          {result.opgehaald === 0 && result.errors.length === 0 && (
            <p className="text-[10px] mt-2" style={{ color: "var(--muted)" }}>
              Shiftbase geeft 0 availability-records voor de komende 8 weken.
              Mogelijk heeft niemand in Shiftbase iets ingevuld, of de API-key
              heeft geen leesrechten op /availabilities.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
