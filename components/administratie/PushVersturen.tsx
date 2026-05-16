"use client";

/**
 * Bulk-push paneel voor owner/manager.
 *
 * Doelgroep-picker:
 *   - "Alle vestigingen" (alleen owner ziet 'm)
 *   - "Mijn vestiging" / "Brunch & Brew" / "Saté Lounge" / "Het Kroket Loket"
 *   - "Selectie…" — multi-select per medewerker
 *
 * Voor manager-rol verbergen we vestigingen buiten z'n eigen.
 */
import { useEffect, useState } from "react";

interface Medewerker {
  id: number;
  naam: string;
  email: string;
  heeftPin: boolean;
  heeftDefaultPin: boolean;
}

interface Props {
  hex: string;
  /** Vestiging-slug van de huidige admin-tab. Voor manager = z'n vestiging. */
  bedrijf: "bb" | "sl" | "kl";
}

type DoelType = "vestiging" | "alle" | "selectie";

const VESTIGING_NAAM: Record<"bb" | "sl" | "kl", string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

export default function PushVersturen({ hex, bedrijf }: Props) {
  const [titel, setTitel] = useState("");
  const [bericht, setBericht] = useState("");
  const [doelType, setDoelType] = useState<DoelType>("vestiging");
  const [doelVestiging, setDoelVestiging] = useState<"bb" | "sl" | "kl">(bedrijf);
  const [selectie, setSelectie] = useState<Set<number>>(new Set());
  const [medewerkers, setMedewerkers] = useState<Medewerker[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [rolOwner, setRolOwner] = useState(false);

  // Lees medewerkers via dezelfde endpoint als activiteit-paneel
  useEffect(() => {
    fetch("/api/admin/medewerker-activiteit", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("kon lijst niet laden");
        const data = await res.json() as { medewerkers: Medewerker[] };
        data.medewerkers.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
        setMedewerkers(data.medewerkers);
      })
      .catch((e) => setFout(e instanceof Error ? e.message : "fout"));

    // Rol uit sessionStorage halen — gezet door PinGate na admin-login.
    if (typeof window !== "undefined") {
      setRolOwner(sessionStorage.getItem("sg_rol") === "owner");
    }
  }, []);

  function toggleSelectie(id: number) {
    setSelectie((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function verstuur() {
    setBezig(true);
    setResultaat(null);
    setFout(null);
    try {
      const doelgroep: Record<string, unknown> = { type: doelType };
      if (doelType === "vestiging") doelgroep.vestiging = doelVestiging;
      if (doelType === "selectie") doelgroep.medewerkerIds = Array.from(selectie);

      const res = await fetch("/api/admin/push/verstuur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel, bericht, doelgroep }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { doelgroep: number; verzonden: number; fouten: number };
      setResultaat(
        `✓ Verzonden naar ${data.verzonden} van ${data.doelgroep} medewerker${data.doelgroep === 1 ? "" : "s"}${
          data.fouten > 0 ? ` (${data.fouten} fouten)` : ""
        }`,
      );
      setTitel("");
      setBericht("");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  const verstuurDisabled =
    bezig ||
    !titel.trim() ||
    !bericht.trim() ||
    (doelType === "selectie" && selectie.size === 0);

  return (
    <section className="rounded-2xl p-4" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text)" }}>
        Bericht aan team
      </h3>
      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Stuur een push-notificatie naar medewerkers. Bv. "Rooster volgende week staat klaar".
      </p>

      <div className="space-y-3">
        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Titel (bv. 'Rooster is klaar')"
          maxLength={80}
          className="w-full px-3 py-2.5 rounded-xl text-[14px]"
          style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text)" }}
        />
        <textarea
          value={bericht}
          onChange={(e) => setBericht(e.target.value)}
          placeholder="Bericht — uitleg / details"
          maxLength={400}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl text-[14px] resize-none"
          style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text)" }}
        />

        <div>
          <p className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>Aan wie</p>
          <div className="flex gap-1.5 flex-wrap mb-2">
            <DoelKnop label="Mijn vestiging" actief={doelType === "vestiging"} hex={hex} onClick={() => { setDoelType("vestiging"); setDoelVestiging(bedrijf); }} />
            {rolOwner && (
              <DoelKnop label="Alle vestigingen" actief={doelType === "alle"} hex={hex} onClick={() => setDoelType("alle")} />
            )}
            <DoelKnop label="Selectie…" actief={doelType === "selectie"} hex={hex} onClick={() => setDoelType("selectie")} />
          </div>

          {doelType === "vestiging" && rolOwner && (
            <select
              value={doelVestiging}
              onChange={(e) => setDoelVestiging(e.target.value as "bb" | "sl" | "kl")}
              className="w-full px-3 py-2 rounded-xl text-[13px]"
              style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            >
              <option value="bb">Brunch &amp; Brew</option>
              <option value="sl">Saté Lounge</option>
              <option value="kl">Het Kroket Loket</option>
            </select>
          )}
          {doelType === "vestiging" && !rolOwner && (
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              → {VESTIGING_NAAM[doelVestiging]}
            </p>
          )}

          {doelType === "selectie" && (
            <div
              className="rounded-xl p-2 max-h-48 overflow-y-auto"
              style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}
            >
              {!medewerkers && (
                <p className="text-[12px] text-center py-3" style={{ color: "var(--muted)" }}>Laden…</p>
              )}
              {medewerkers && medewerkers.length === 0 && (
                <p className="text-[12px] text-center py-3" style={{ color: "var(--muted)" }}>Geen medewerkers</p>
              )}
              {medewerkers?.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer hover:opacity-80"
                >
                  <input
                    type="checkbox"
                    checked={selectie.has(m.id)}
                    onChange={() => toggleSelectie(m.id)}
                  />
                  <span className="text-[12px] flex-1" style={{ color: "var(--text)" }}>{m.naam}</span>
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>{m.email}</span>
                </label>
              ))}
              {medewerkers && medewerkers.length > 0 && (
                <div className="flex gap-2 mt-2 px-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectie(new Set(medewerkers.map((m) => m.id)))}
                    className="text-[11px] underline"
                    style={{ color: hex }}
                  >
                    Alles
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectie(new Set())}
                    className="text-[11px] underline"
                    style={{ color: "var(--muted)" }}
                  >
                    Geen
                  </button>
                  <span className="text-[11px] ml-auto" style={{ color: "var(--muted)" }}>
                    {selectie.size} geselecteerd
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {resultaat && (
          <p className="text-[12px]" style={{ color: "#30B26F" }}>{resultaat}</p>
        )}
        {fout && (
          <p className="text-[12px]" style={{ color: "#E5484D" }}>{fout}</p>
        )}

        <button
          onClick={verstuur}
          disabled={verstuurDisabled}
          className="w-full py-3 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50"
          style={{ background: hex }}
        >
          {bezig ? "Bezig…" : "🔔 Verstuur push-notificatie"}
        </button>
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>
          Tip: medewerkers krijgen alleen een push als ze notificaties hebben aangezet in de app.
          Max 5 berichten per uur.
        </p>
      </div>
    </section>
  );
}

function DoelKnop({ label, actief, hex, onClick }: { label: string; actief: boolean; hex: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[12px] transition-colors"
      style={{
        background: actief ? hex : "transparent",
        color: actief ? "#fff" : "var(--text-2)",
        border: `1px solid ${actief ? hex : "var(--hairline)"}`,
      }}
    >
      {label}
    </button>
  );
}
