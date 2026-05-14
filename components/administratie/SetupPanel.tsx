"use client";

import { useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

interface Props {
  hex: string;
}

interface DbInitResultaat {
  naam: string;
  statementsUitgevoerd: number;
  duurMs: number;
}

interface MigratieResultaat {
  departments: number;
  medewerkersNieuw: number;
  medewerkersBijgewerkt: number;
  templatesGesynct: number;
  rostersNieuw: number;
  rostersBijgewerkt: number;
  beschikbaarheidGesynct: number;
  duurMs: number;
  log: string[];
}

interface ZettleSnapshotResultaat {
  ok: boolean;
  duurMs: number;
  resultaten: Array<{
    bedrijf: "bb" | "sl" | "kl";
    opgehaaldRaw: number;
    ingevoegd: number;
    fout?: string;
  }>;
}

interface BulkUurlonenResultaat {
  ok: boolean;
  succesvol: number;
  totaal: number;
  resultaten: Array<{
    identifier: string;
    matched: boolean;
    medewerker?: { id: number; naam: string; oudUurloon: number | null; nieuwUurloon: number };
    reden?: string;
  }>;
}

// Voorgeschreven BB-uurlonen (uit loonsysteem). Owner kan ze met één klik
// importeren — geen handmatige SQL of inline-edits per persoon meer.
const BB_UURLONEN = [
  { identifier: "7",  uurloon: 14.75, naam: "D Tuncel" },
  { identifier: "18", uurloon: 14.75, naam: "S van Nieuwenhoven" },
  { identifier: "32", uurloon: 11.05, naam: "MW den Otter" },
  { identifier: "33", uurloon: 16.00, naam: "T Costa" },
  { identifier: "35", uurloon: 11.05, naam: "S Ahanssas" },
  { identifier: "37", uurloon: 11.05, naam: "J.P. Meijer" },
  { identifier: "38", uurloon: 12.50, naam: "H Correa Radwanski" },
  { identifier: "40", uurloon: 12.50, naam: "L Chirinos" },
  { identifier: "41", uurloon: 14.75, naam: "ME van Perlak" },
  { identifier: "42", uurloon: 14.75, naam: "T van Salvan" },
  { identifier: "43", uurloon:  9.75, naam: "D de Willigen" },
];

export default function SetupPanel({ hex }: Props) {
  const [busy, setBusy] = useState<"db" | "migratie" | "zettle" | "uurlonen" | null>(null);
  const [dbResult, setDbResult] = useState<DbInitResultaat[] | null>(null);
  const [migrResult, setMigrResult] = useState<MigratieResultaat | null>(null);
  const [zettleResult, setZettleResult] = useState<ZettleSnapshotResultaat | null>(null);
  const [uurlonenResult, setUurlonenResult] = useState<BulkUurlonenResultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function importeerBbUurlonen() {
    if (!confirm(`Alle ${BB_UURLONEN.length} BB-uurlonen importeren? Bestaande waarden worden overschreven. Idempotent.`)) return;
    setBusy("uurlonen");
    setFout(null);
    setUurlonenResult(null);
    try {
      const res = await fetch("/api/admin/bulk-uurlonen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vestiging: "bb",
          regels: BB_UURLONEN.map((r) => ({ identifier: r.identifier, uurloon: r.uurloon })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "import mislukt");
      }
      const j = (await res.json()) as BulkUurlonenResultaat;
      setUurlonenResult(j);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(null);
    }
  }

  async function runDbInit() {
    if (!confirm("Nieuwe DB-tabellen aanmaken in Neon (audit_log + salaris_perioden)?\n\nVeilig om meerdere keren te doen — bestaande tabellen blijven onaangetast.")) return;
    setBusy("db");
    setFout(null);
    try {
      const res = await fetch("/api/admin/db-init", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "db-init mislukt");
      }
      const j = (await res.json()) as { resultaten: DbInitResultaat[] };
      setDbResult(j.resultaten);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(null);
    }
  }

  async function runZettleSnapshot() {
    if (!confirm("Volledige Zettle-historie naar onze database kopiëren?\n\nDuurt 1-3 min per bedrijf. Daarna leest het dashboard / forecast / AI direct uit de database — geen Zettle API-calls meer voor historische data. Idempotent: bestaande records worden overgeslagen.")) return;
    setBusy("zettle");
    setFout(null);
    setZettleResult(null);
    try {
      const res = await fetch("/api/administratie/zettle-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "snapshot mislukt");
      }
      const j = (await res.json()) as ZettleSnapshotResultaat;
      setZettleResult(j);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(null);
    }
  }

  async function runMigratie() {
    if (!confirm("12 maanden historie + 3 maanden vooruit uit Shiftbase importeren in onze DB?\n\nDit kan 1-5 minuten duren afhankelijk van datavolume. Idempotent: opnieuw draaien is veilig (bestaande records worden bijgewerkt, niet gedupliceerd).")) return;
    setBusy("migratie");
    setFout(null);
    setMigrResult(null);
    try {
      const res = await fetch("/api/admin/migreer-shiftbase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "migratie mislukt");
      }
      const j = (await res.json()) as MigratieResultaat;
      setMigrResult(j);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <LoadingOverlay
        zichtbaar={busy === "db"}
        titel="Tabellen aanmaken"
        subtitel="Bezig met aanmaken van audit_log en salaris_perioden in Neon"
        accent={hex}
        toonTimer
      />
      <LoadingOverlay
        zichtbaar={busy === "migratie"}
        titel="Shiftbase-historie importeren"
        subtitel="12 maanden aan diensten + medewerkers + beschikbaarheid wordt opgehaald. Dit kan 1-5 min duren."
        accent={hex}
        toonTimer
      />
      <LoadingOverlay
        zichtbaar={busy === "zettle"}
        titel="Zettle-historie kopiëren naar database"
        subtitel="Alle purchases per bedrijf worden in batches naar Postgres geschreven. Daarna leest de app uit de DB ipv de Zettle API. Kan 1-3 min per bedrijf duren."
        accent={hex}
        toonTimer
      />
      <LoadingOverlay
        zichtbaar={busy === "uurlonen"}
        titel="Uurlonen importeren"
        subtitel="Per medewerker matchen we op shiftbase_user_id en updaten uurloon + thuis-vestiging."
        accent={hex}
      />
    <div className="card">
      <p className="eyebrow mb-1">Setup</p>
      <h2 className="text-[16px] font-semibold mb-3" style={{ color: "var(--text)" }}>
        Database & Shiftbase migratie
      </h2>

      <div className="space-y-3">
        {/* Stap 1: DB-tabellen */}
        <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                1. Maak nieuwe DB-tabellen aan
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                <code>audit_log</code> en <code>salaris_perioden</code> — vereist
                voor de audit-log + salaris-administratie endpoints.
              </p>
            </div>
            <button
              onClick={runDbInit}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white shrink-0 disabled:opacity-50"
              style={{ background: hex }}
            >
              {busy === "db" ? "Bezig…" : "Uitvoeren"}
            </button>
          </div>
          {dbResult && (
            <div className="mt-3 text-[11px]" style={{ color: "#30B26F" }}>
              ✓ {dbResult.map((r) => `${r.naam} (${r.statementsUitgevoerd} stmts, ${r.duurMs}ms)`).join(" · ")}
            </div>
          )}
        </div>

        {/* Stap 2: Shiftbase migratie */}
        <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                2. Importeer Shiftbase-historie
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                12 maanden historie + 3 maanden vooruit. Departments,
                medewerkers, templates, rosters en beschikbaarheid. Duurt
                1-5 min. Idempotent.
              </p>
            </div>
            <button
              onClick={runMigratie}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white shrink-0 disabled:opacity-50"
              style={{ background: hex }}
            >
              {busy === "migratie" ? "Bezig…" : "Importeer"}
            </button>
          </div>
          {migrResult && (
            <div className="mt-3 text-[11px] space-y-1" style={{ color: "var(--text-2)" }}>
              <p style={{ color: "#30B26F" }}>✓ Klaar in {(migrResult.duurMs / 1000).toFixed(1)}s</p>
              <p>{migrResult.medewerkersNieuw} nieuwe / {migrResult.medewerkersBijgewerkt} bijgewerkte medewerkers</p>
              <p>{migrResult.templatesGesynct} shift-templates</p>
              <p>{migrResult.rostersNieuw} nieuwe / {migrResult.rostersBijgewerkt} bijgewerkte diensten</p>
              <p>{migrResult.beschikbaarheidGesynct} beschikbaarheid-entries</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px]" style={{ color: "var(--muted)" }}>Volledig log</summary>
                <pre className="mt-2 p-2 rounded-[6px] text-[10px] overflow-x-auto" style={{ background: "var(--bg-elev)", color: "var(--text)" }}>
                  {migrResult.log.join("\n")}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Stap 3: Zettle-snapshot */}
        <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                3. Zettle-historie → database
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Eenmalige backfill van alle iZettle-purchases per bedrijf naar
                onze Postgres. Daarna leest dashboard / forecast / AI direct
                uit de DB ipv de paginated Zettle API — milliseconden ipv
                seconden. Daily cron prikt nieuwe purchases er vanzelf bij.
              </p>
            </div>
            <button
              onClick={runZettleSnapshot}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white shrink-0 disabled:opacity-50"
              style={{ background: hex }}
            >
              {busy === "zettle" ? "Bezig…" : "Snapshot"}
            </button>
          </div>
          {zettleResult && (
            <div className="mt-3 text-[11px] space-y-1" style={{ color: "var(--text-2)" }}>
              <p style={{ color: zettleResult.ok ? "#30B26F" : "#E5484D" }}>
                {zettleResult.ok ? "✓" : "⚠"} Klaar in {(zettleResult.duurMs / 1000).toFixed(1)}s
              </p>
              {zettleResult.resultaten.map((r) => (
                <p key={r.bedrijf}>
                  <strong>{r.bedrijf.toUpperCase()}</strong>: {r.opgehaaldRaw} opgehaald, {r.ingevoegd} nieuw in DB
                  {r.fout && <span style={{ color: "#E5484D" }}> · fout: {r.fout}</span>}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Stap 4: Bulk-import uurlonen */}
        <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                4. Importeer BB-uurlonen
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Eenmalige import van {BB_UURLONEN.length} uurlonen voor Brunch & Brew + thuis-vestiging zetten.
                Idempotent — opnieuw klikken overschrijft. Bron: jouw loonsysteem-screenshot mei 2026.
              </p>
            </div>
            <button
              onClick={importeerBbUurlonen}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white shrink-0 disabled:opacity-50"
              style={{ background: hex }}
            >
              {busy === "uurlonen" ? "Bezig…" : "Importeer"}
            </button>
          </div>
          {uurlonenResult && (
            <div className="mt-3 text-[11px] space-y-1" style={{ color: "var(--text-2)" }}>
              <p style={{ color: uurlonenResult.succesvol === uurlonenResult.totaal ? "#30B26F" : "#E07A1F" }}>
                ✓ {uurlonenResult.succesvol} / {uurlonenResult.totaal} succesvol
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px]" style={{ color: "var(--muted)" }}>
                  Volledig log
                </summary>
                <ul className="mt-1.5 space-y-0.5">
                  {uurlonenResult.resultaten.map((r, i) => (
                    <li key={i} className="text-[10px]" style={{ color: r.matched ? "var(--text-2)" : "#E5484D" }}>
                      {r.matched && r.medewerker
                        ? `✓ ${r.medewerker.naam}: €${r.medewerker.nieuwUurloon.toFixed(2)}${r.medewerker.oudUurloon ? ` (was €${r.medewerker.oudUurloon.toFixed(2)})` : ""}`
                        : `✗ ${r.identifier}: ${r.reden ?? "fout"}`}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>

        {fout && (
          <p className="text-[12px]" style={{ color: "#E5484D" }}>
            Fout: {fout}
          </p>
        )}
      </div>
    </div>
    </>
  );
}
