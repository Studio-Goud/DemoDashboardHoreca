"use client";

/**
 * Owner-overzicht: wie is nu een actieve gebruiker van de app, en wie nog niet?
 *
 * Drie statussen per medewerker:
 *   ⚪ Geen account-toegang  (pin_hash IS NULL)
 *   🟡 Default PIN nog niet gewijzigd (pin_hash IS NOT NULL EN moet_pin_resetten)
 *   🟢 Actieve gebruiker     (eigen PIN gezet; eventueel ook Face ID)
 *
 * Plus: laatste login + aantal geregistreerde passkeys per medewerker.
 */
import { useEffect, useState } from "react";

interface Rij {
  id: number;
  naam: string;
  email: string;
  heeftPin: boolean;
  heeftDefaultPin: boolean;
  heeftPasskey: boolean;
  passkeyAantal: number;
  laatsteLogin: string | null;
  onboardingVoltooid: boolean;
  goedgekeurd: boolean;
}

type Filter = "alle" | "actief" | "default" | "geen";

interface Props { hex: string }

function relativeTijd(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const uur = Math.floor(min / 60);
  if (uur < 24) return `${uur} uur geleden`;
  const dagen = Math.floor(uur / 24);
  if (dagen < 7) return `${dagen}d geleden`;
  if (dagen < 30) return `${Math.floor(dagen / 7)}w geleden`;
  if (dagen < 365) return `${Math.floor(dagen / 30)}mnd geleden`;
  return `${Math.floor(dagen / 365)}j geleden`;
}

function statusVan(r: Rij): "actief" | "default" | "geen" {
  if (r.heeftPin) return "actief";
  if (r.heeftDefaultPin) return "default";
  return "geen";
}

const STATUS_LABEL: Record<"actief" | "default" | "geen", string> = {
  actief: "Actieve gebruiker",
  default: "Default PIN (1234)",
  geen:    "Geen account",
};

const STATUS_KLEUR: Record<"actief" | "default" | "geen", string> = {
  actief: "#30B26F",
  default: "#E0A82E",
  geen:    "#9CA3AF",
};

export default function MedewerkerActiviteitPanel({ hex }: Props) {
  const [rijen, setRijen] = useState<Rij[] | null>(null);
  const [filter, setFilter] = useState<Filter>("alle");
  const [fout, setFout] = useState<string | null>(null);

  async function laad() {
    try {
      const res = await fetch("/api/admin/medewerker-activiteit", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "kon niet laden");
      }
      const data = await res.json() as { medewerkers: Rij[] };
      data.medewerkers.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
      setRijen(data.medewerkers);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    }
  }

  useEffect(() => { laad(); }, []);

  if (fout) {
    return (
      <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text)" }}>Gebruikers-activiteit</h3>
        <p className="text-[12px]" style={{ color: "#E5484D" }}>{fout}</p>
      </section>
    );
  }

  if (!rijen) {
    return (
      <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>Gebruikers-activiteit</h3>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>Laden…</p>
      </section>
    );
  }

  const tellingActief = rijen.filter((r) => statusVan(r) === "actief").length;
  const tellingDefault = rijen.filter((r) => statusVan(r) === "default").length;
  const tellingGeen = rijen.filter((r) => statusVan(r) === "geen").length;
  const tellingPasskey = rijen.filter((r) => r.heeftPasskey).length;

  const gefilterd = filter === "alle"
    ? rijen
    : rijen.filter((r) => statusVan(r) === filter);

  return (
    <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
          Gebruikers-activiteit
        </h3>
        <button onClick={laad} className="text-[11px]" style={{ color: hex }}>
          ↻ Ververs
        </button>
      </div>

      {/* Samenvatting */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Statistiek label="Actief" waarde={tellingActief} kleur={STATUS_KLEUR.actief} totaal={rijen.length} />
        <Statistiek label="Default PIN" waarde={tellingDefault} kleur={STATUS_KLEUR.default} totaal={rijen.length} />
        <Statistiek label="Geen account" waarde={tellingGeen} kleur={STATUS_KLEUR.geen} totaal={rijen.length} />
      </div>
      {tellingPasskey > 0 && (
        <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
          🔐 {tellingPasskey} medewerker{tellingPasskey === 1 ? "" : "s"} heeft Face ID / Touch ID ingesteld.
        </p>
      )}

      {/* Filter */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(["alle", "actief", "default", "geen"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2.5 py-1 rounded-full text-[11px] transition-colors"
            style={{
              background: filter === f ? hex : "transparent",
              color: filter === f ? "#fff" : "var(--text-2)",
              border: `1px solid ${filter === f ? hex : "var(--hairline)"}`,
            }}
          >
            {f === "alle" ? "Alle" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Lijst */}
      <div className="space-y-1.5">
        {gefilterd.length === 0 && (
          <p className="text-[12px] text-center py-4" style={{ color: "var(--muted)" }}>
            Geen medewerkers in deze categorie.
          </p>
        )}
        {gefilterd.map((r) => {
          const s = statusVan(r);
          return (
            <div
              key={r.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
              style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: STATUS_KLEUR[s] }}
                title={STATUS_LABEL[s]}
                aria-label={STATUS_LABEL[s]}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>
                  {r.naam}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--muted)" }}>
                  {r.email}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {r.laatsteLogin ? (
                  <p className="text-[11px] tabular-nums" style={{ color: "var(--text-2)" }}>
                    {relativeTijd(r.laatsteLogin)}
                  </p>
                ) : (
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    nooit ingelogd
                  </p>
                )}
                {r.heeftPasskey && (
                  <p className="text-[10px]" style={{ color: STATUS_KLEUR.actief }}>
                    🔐 {r.passkeyAantal} apparaat{r.passkeyAantal === 1 ? "" : "en"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] mt-3" style={{ color: "var(--muted)" }}>
        Tip: medewerkers met "Default PIN" hebben hun login wel ontvangen maar nog niet hun eigen PIN gekozen.
        Stuur ze een berichtje om in te loggen op /m met PIN 1234 — daarna kiezen ze een eigen PIN.
      </p>
    </section>
  );
}

function Statistiek({ label, waarde, kleur, totaal }: { label: string; waarde: number; kleur: string; totaal: number }) {
  const pct = totaal === 0 ? 0 : Math.round((waarde / totaal) * 100);
  return (
    <div
      className="rounded-xl p-2.5"
      style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
    >
      <p className="text-[10px]" style={{ color: "var(--muted)" }}>{label}</p>
      <p className="text-[20px] font-semibold tabular-nums leading-tight" style={{ color: kleur }}>
        {waarde}
      </p>
      <p className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
        {pct}% van {totaal}
      </p>
    </div>
  );
}
