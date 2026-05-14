"use client";

import { useState, useEffect, useCallback } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import PushAanmelden from "@/components/PushAanmelden";

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

// Voorgeschreven uurlonen per vestiging (uit loonsysteem mei 2026).
// BB-tabel is exact uit bruto-uurloon overzicht. SL/KL zijn berekend uit
// Vergoedingen-belast / Uren in het loonkosten-overzicht (incl. vakgeld-
// component) — owner kan via de inline-editor in Salaris-tab finetunen.
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

const SL_UURLONEN = [
  // Terug-gerekend uit Vergoedingen/Uren ÷ 1.1633 (vakgeld 8.33% + verlof 8%)
  // zodat de app's defaults dezelfde totale-bruto reproduceren als in het
  // loonsysteem mei 2026. Owner kan via inline-editor finetunen.
  { identifier: "1",  uurloon: 17.04, naam: "S Mathoera" },
  { identifier: "4",  uurloon: 15.16, naam: "L Broeders" },
  { identifier: "10", uurloon: 13.69, naam: "K Itjoejaree" },
  { identifier: "13", uurloon: 10.44, naam: "J Maat" },
  { identifier: "23", uurloon: 13.69, naam: "LL Ysulan" },
  { identifier: "26", uurloon: 13.69, naam: "M De Carvalho Pinho Barbo" },
  { identifier: "27", uurloon: 13.69, naam: "M Canini" },
  { identifier: "28", uurloon: 10.31, naam: "JR Person Snoei" },
  { identifier: "29", uurloon: 13.69, naam: "DRB Nakchedi" },
];

const KL_UURLONEN = [
  // Terug-gerekend zoals SL.
  { identifier: "20", uurloon: 15.15, naam: "N.J. Korff" },
  { identifier: "30", uurloon: 15.15, naam: "N Yonathan" },
  { identifier: "33", uurloon: 10.31, naam: "ISL Psarianou" },
  { identifier: "36", uurloon: 15.15, naam: "BEM de Bruin" },
  { identifier: "43", uurloon: 16.95, naam: "G Gasparinetti" },
  { identifier: "44", uurloon: 10.63, naam: "H de Vroom" },
  { identifier: "49", uurloon:  8.96, naam: "F Kort" },
  { identifier: "52", uurloon:  6.17, naam: "F Giuntoli" },
  { identifier: "53", uurloon: 11.61, naam: "S de Bruijn" },
  { identifier: "54", uurloon: 10.26, naam: "RI el Kaka" },
  { identifier: "55", uurloon: 10.09, naam: "XI Pelt" },
];

const UURLONEN_PER_VESTIGING = {
  bb: { naam: "Brunch & Brew", data: BB_UURLONEN },
  sl: { naam: "Saté Lounge",   data: SL_UURLONEN },
  kl: { naam: "Het Kroket Loket", data: KL_UURLONEN },
} as const;

export default function SetupPanel({ hex }: Props) {
  const [busy, setBusy] = useState<"db" | "migratie" | "zettle" | "uurlonen" | null>(null);
  const [dbResult, setDbResult] = useState<DbInitResultaat[] | null>(null);
  const [migrResult, setMigrResult] = useState<MigratieResultaat | null>(null);
  const [zettleResult, setZettleResult] = useState<ZettleSnapshotResultaat | null>(null);
  const [uurlonenResult, setUurlonenResult] = useState<BulkUurlonenResultaat | null>(null);
  const [pushStatus, setPushStatus] = useState<{
    push: { vapidGezet: boolean; kvBeschikbaar: boolean };
    notify: { webpush: boolean; telegram: boolean; email: boolean };
    subscribers: number;
    klaarVoorGebruik: boolean;
  } | null>(null);
  const [testBezig, setTestBezig] = useState(false);
  const [testResultaat, setTestResultaat] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const laadPushStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/push-status", { cache: "no-store" });
      if (res.ok) setPushStatus(await res.json());
    } catch { /* stil */ }
  }, []);

  useEffect(() => { laadPushStatus(); }, [laadPushStatus]);

  async function stuurTestNotificatie() {
    setTestBezig(true);
    setTestResultaat(null);
    try {
      const res = await fetch("/api/admin/push-test", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "test mislukt");
      const gelukt = Array.isArray(j.resultaten)
        ? j.resultaten.filter((r: { gelukt: boolean }) => r.gelukt).length
        : 0;
      const totaal = Array.isArray(j.resultaten) ? j.resultaten.length : 0;
      setTestResultaat(`✓ Verzonden naar ${gelukt}/${totaal} kanaal/kanalen. Check binnen ~5s.`);
    } catch (e) {
      setTestResultaat(`✗ ${e instanceof Error ? e.message : "fout"}`);
    } finally {
      setTestBezig(false);
    }
  }

  async function importeerUurlonen(vestiging: "bb" | "sl" | "kl") {
    const cfg = UURLONEN_PER_VESTIGING[vestiging];
    if (!confirm(`Alle ${cfg.data.length} uurlonen voor ${cfg.naam} importeren? Bestaande waarden worden overschreven. Idempotent.`)) return;
    setBusy("uurlonen");
    setFout(null);
    setUurlonenResult(null);
    try {
      const res = await fetch("/api/admin/bulk-uurlonen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vestiging,
          regels: cfg.data.map((r) => ({ identifier: r.identifier, uurloon: r.uurloon })),
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

        {/* Stap 4: Bulk-import uurlonen per vestiging */}
        <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
          <div className="mb-2">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
              4. Importeer uurlonen + thuis-vestiging
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              Eenmalige import uit loonsysteem mei 2026. Bestaande waarden worden overschreven (idempotent).
              Per vestiging matcht de import op shiftbase_user_id; bij gelijke ID over vestigingen win de laatste klik.
              Owner kan daarna via de inline-editor in Salaris finetunen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["bb", "sl", "kl"] as const).map((slug) => {
              const cfg = UURLONEN_PER_VESTIGING[slug];
              return (
                <button
                  key={slug}
                  onClick={() => importeerUurlonen(slug)}
                  disabled={busy !== null}
                  className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white shrink-0 disabled:opacity-50"
                  style={{ background: hex }}
                  title={`${cfg.data.length} medewerkers`}
                >
                  {busy === "uurlonen" ? "Bezig…" : `${cfg.naam} (${cfg.data.length})`}
                </button>
              );
            })}
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

        {/* Stap 5: Push-notificaties */}
        <div className="rounded-[10px] p-3" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
          <div className="mb-2">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
              5. Push-notificaties
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              Krijg meldingen bij kritieke voorraad (07:00 NL), grote onbekende
              transacties bij ING-upload, en wanneer een rooster gepubliceerd is.
            </p>
          </div>

          {/* Config-diagnose */}
          {pushStatus && (
            <div className="text-[11px] mb-3 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums" style={{ color: "var(--text-2)" }}>
              <span>VAPID-sleutels in Vercel</span>
              <span style={{ color: pushStatus.push.vapidGezet ? "#30B26F" : "#E5484D" }}>
                {pushStatus.push.vapidGezet ? "✓ ingesteld" : "✗ ontbreekt"}
              </span>
              <span>KV-storage</span>
              <span style={{ color: pushStatus.push.kvBeschikbaar ? "#30B26F" : "#E5484D" }}>
                {pushStatus.push.kvBeschikbaar ? "✓ beschikbaar" : "✗ niet geconfigureerd"}
              </span>
              <span>Actieve subscribers</span>
              <span style={{ color: pushStatus.subscribers > 0 ? "#30B26F" : "#E07A1F" }}>
                {pushStatus.subscribers} {pushStatus.subscribers === 1 ? "apparaat" : "apparaten"}
              </span>
            </div>
          )}

          {pushStatus && !pushStatus.klaarVoorGebruik && (
            <div className="rounded-md p-2.5 mb-3 text-[11px]" style={{ background: "#FFF7E6", border: "1px solid #F0B731", color: "#9F6700" }}>
              ⚠️ Eerst <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> + <code>VAPID_PRIVATE_KEY</code> + Vercel KV
              configureren in de Vercel-dashboard onder Settings → Environment Variables. Daarna deze
              pagina herladen.
            </div>
          )}

          {pushStatus?.klaarVoorGebruik && (
            <>
              {/* Subscribe-knop voor dit apparaat */}
              <div className="mb-3">
                <PushAanmelden hex={hex} />
              </div>

              {/* Test-notificatie */}
              <button
                onClick={stuurTestNotificatie}
                disabled={testBezig || pushStatus.subscribers === 0}
                className="text-[12px] px-3 py-1.5 rounded text-white disabled:opacity-50"
                style={{ background: hex }}
              >
                {testBezig ? "Bezig…" : "🔔 Stuur test-notificatie"}
              </button>
              {pushStatus.subscribers === 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
                  Eerst aanmelden hierboven voordat je een test kan sturen.
                </p>
              )}
              {testResultaat && (
                <p className="text-[11px] mt-2" style={{ color: testResultaat.startsWith("✓") ? "#30B26F" : "#E5484D" }}>
                  {testResultaat}
                </p>
              )}
            </>
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
