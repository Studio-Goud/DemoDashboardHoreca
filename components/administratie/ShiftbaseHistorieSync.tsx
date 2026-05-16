"use client";

/**
 * Owner-paneel: status van de Shiftbase rooster-historie + knop om
 * 365 dagen historie opnieuw op te halen.
 *
 * Wordt nightly auto-gesynct (30d achterstand + 90d vooruit) via cron,
 * maar voor de eerste keer of na een gap kun je 'm hier handmatig
 * vol-jaars triggeren. Kan 1-3 min duren — UI toont een spinner.
 */
import { useEffect, useState } from "react";

interface Status {
  totaal: number;
  oudste: string | null;
  nieuwste: string | null;
  historisch: number;
}

interface SyncResultaat {
  ok: boolean;
  dagenTerug: number;
  dagenVooruit: number;
  rostersNieuw: number;
  rostersBijgewerkt: number;
  rostersOvergeslagen: number;
  medewerkersGesynct: number;
  chunks: number;
  duurMs: number;
  errors: string[];
}

interface Props { hex: string }

function nlDatum(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function dagenGeleden(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const diff = (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}

export default function ShiftbaseHistorieSync({ hex }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [bezig, setBezig] = useState(false);
  const [laatsteResult, setLaatsteResult] = useState<SyncResultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [rolOwner, setRolOwner] = useState(false);

  async function laad() {
    try {
      const res = await fetch("/api/admin/shiftbase/sync", { cache: "no-store" });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch { /* stil */ }
  }

  useEffect(() => {
    laad();
    if (typeof window !== "undefined") {
      setRolOwner(sessionStorage.getItem("sg_rol") === "owner");
    }
  }, []);

  async function sync(dagenTerug: number) {
    setBezig(true);
    setFout(null);
    setLaatsteResult(null);
    try {
      const res = await fetch("/api/admin/shiftbase/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dagenTerug, dagenVooruit: 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLaatsteResult(data);
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  if (!rolOwner) return null;

  const oudsteDagen = dagenGeleden(status?.oudste ?? null);
  const heeftHistorie = (status?.historisch ?? 0) > 100;
  const aanbevolenSync = !heeftHistorie || (oudsteDagen !== null && oudsteDagen < 300);

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
          Shiftbase historie
        </h3>
        {aanbevolenSync && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#E0A82E22", color: "#E0A82E" }}>
            sync aanbevolen
          </span>
        )}
      </div>

      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Voor het bezettingsadvies moeten rooster-gegevens van vorig jaar in onze database staan.
        Nightly cron pakt 30 dagen achterstand op; voor backfill van een vol jaar druk hieronder.
      </p>

      {status && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Rosters totaal" waarde={status.totaal.toLocaleString("nl-NL")} hex={hex} />
          <Stat label="Oudste rooster" waarde={nlDatum(status.oudste)} hex={hex} sub={oudsteDagen !== null ? `${oudsteDagen}d terug` : undefined} />
          <Stat label="Historisch" waarde={status.historisch.toLocaleString("nl-NL")} hex={hex} sub="< vandaag" />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => sync(365)}
          disabled={bezig}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60"
          style={{ background: hex }}
        >
          {bezig ? "Bezig… (kan 1–3 min duren)" : "📥 Sync vol jaar historie (365d)"}
        </button>
        <button
          onClick={() => sync(30)}
          disabled={bezig}
          className="px-4 py-2.5 rounded-xl text-[13px]"
          style={{
            background: "transparent",
            color: "var(--text-2)",
            border: "1px solid var(--hairline)",
          }}
        >
          Snelle sync (30d)
        </button>
      </div>

      {fout && (
        <p className="text-[12px] mt-3" style={{ color: "#E5484D" }}>{fout}</p>
      )}

      {laatsteResult && (
        <div
          className="mt-3 rounded-xl p-3 text-[12px]"
          style={{ background: "#30B26F15", border: "1px solid #30B26F55", color: "var(--text)" }}
        >
          <p>
            ✓ Sync klaar in {(laatsteResult.duurMs / 1000).toFixed(1)}s ·{" "}
            <strong>{laatsteResult.rostersNieuw}</strong> nieuwe rosters,{" "}
            <strong>{laatsteResult.rostersBijgewerkt}</strong> bijgewerkt
            {laatsteResult.rostersOvergeslagen > 0 && `, ${laatsteResult.rostersOvergeslagen} overgeslagen`}.
          </p>
          {laatsteResult.errors.length > 0 && (
            <p className="mt-1 text-[11px]" style={{ color: "#E5484D" }}>
              {laatsteResult.errors.length} fout{laatsteResult.errors.length === 1 ? "" : "en"}: {laatsteResult.errors[0]}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, waarde, hex, sub }: { label: string; waarde: string; hex: string; sub?: string }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
      <p className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="text-[15px] font-semibold tabular-nums" style={{ color: hex }}>
        {waarde}
      </p>
      {sub && <p className="text-[10px]" style={{ color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}
