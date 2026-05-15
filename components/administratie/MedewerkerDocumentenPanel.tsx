"use client";

/**
 * Owner-review paneel voor medewerker-documenten + loonadministratie-gegevens.
 *
 * Bovenste lijstje: alle actieve medewerkers met onboarding-status. Klik op
 * één om de detail-view in te klappen met NAW + IBAN + (ontsleutelde) BSN
 * + foto's. Per foto: bekijken / goedkeuren / verwijderen.
 */
import { useEffect, useState } from "react";

interface MedewerkerRij {
  id: number;
  voornaam: string;
  achternaam: string;
  email: string;
  onboardingVoltooid: boolean;
  aantalDocs: number;
  aantalGoedgekeurd: number;
}

interface DocRij {
  id: number;
  type: string;
  mimetype: string;
  bestandsnaam: string | null;
  grootteBytes: number;
  geuploadOp: string;
  goedgekeurd: boolean;
  goedgekeurdDoor: string | null;
  goedgekeurdOp: string | null;
}

interface MedewerkerDetail {
  medewerker: {
    id: number;
    voornaam: string;
    achternaam: string;
    email: string;
    telefoon: string | null;
    geboortedatum: string | null;
    straat: string | null;
    huisnummer: string | null;
    postcode: string | null;
    woonplaats: string | null;
    iban: string | null;
    bsn: string | null;
    onboardingVoltooid: boolean;
  };
  documenten: DocRij[];
}

const TYPE_LABELS: Record<string, string> = {
  "id-voor": "ID voor",
  "id-achter": "ID achter",
  "paspoort": "Paspoort",
  "bankpas": "Bankpas",
};

interface Props { hex: string }

export default function MedewerkerDocumentenPanel({ hex }: Props) {
  const [rijen, setRijen] = useState<MedewerkerRij[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MedewerkerDetail | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  async function laadLijst() {
    setLaden(true);
    try {
      const res = await fetch("/api/admin/medewerker-documenten", { cache: "no-store" });
      if (!res.ok) {
        setRijen([]);
        return;
      }
      const j = await res.json() as { medewerkers: MedewerkerRij[] };
      setRijen(j.medewerkers);
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => { laadLijst(); }, []);

  async function openMedewerker(id: number) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    const res = await fetch(`/api/admin/medewerker-documenten?medewerkerId=${id}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }

  async function zetGoedgekeurd(docId: number, goedgekeurd: boolean) {
    setFout(null);
    const res = await fetch(`/api/admin/medewerker-documenten/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goedgekeurd }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "fout" }));
      setFout(j.error || "actie mislukt");
      return;
    }
    if (openId) {
      const r2 = await fetch(`/api/admin/medewerker-documenten?medewerkerId=${openId}`, { cache: "no-store" });
      if (r2.ok) setDetail(await r2.json());
    }
    laadLijst();
  }

  async function verwijderDoc(docId: number) {
    if (!confirm("Document verwijderen? Medewerker moet 'm opnieuw uploaden.")) return;
    const res = await fetch(`/api/admin/medewerker-documenten/${docId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "fout" }));
      setFout(j.error || "verwijderen mislukt");
      return;
    }
    if (openId) {
      const r2 = await fetch(`/api/admin/medewerker-documenten?medewerkerId=${openId}`, { cache: "no-store" });
      if (r2.ok) setDetail(await r2.json());
    }
    laadLijst();
  }

  return (
    <div className="card">
      <p className="eyebrow mb-1">Loonadministratie</p>
      <h2 className="text-[16px] font-semibold mb-3" style={{ color: "var(--text)" }}>
        🪪 Medewerker-documenten
      </h2>
      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Review NAW, IBAN, BSN en ID/bankpas-foto's. Foto's worden alleen
        on-demand ontsleuteld. Goedgekeurde docs kan medewerker niet meer
        zelf verwijderen.
      </p>

      {laden ? (
        <div className="h-20 bg-slate-50 rounded animate-pulse" />
      ) : rijen.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Nog geen actieve medewerkers met documenten.</p>
      ) : (
        <ul className="space-y-2">
          {rijen.map((r) => (
            <li key={r.id} className="rounded-lg border" style={{ borderColor: "var(--hairline)" }}>
              <button
                onClick={() => openMedewerker(r.id)}
                className="w-full text-left p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {r.voornaam} {r.achternaam}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>{r.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    r.onboardingVoltooid ? "" : ""
                  }`} style={{
                    background: r.onboardingVoltooid ? "#30B26F" : "#F0B731",
                    color: "#fff",
                  }}>
                    {r.onboardingVoltooid ? "✓ Compleet" : "Onboarding open"}
                  </span>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {r.aantalGoedgekeurd}/{r.aantalDocs} docs gekeurd
                  </p>
                </div>
              </button>

              {openId === r.id && detail && detail.medewerker.id === r.id && (
                <div className="border-t p-3 space-y-3" style={{ borderColor: "var(--hairline)", background: "var(--bg)" }}>
                  {/* NAW + IBAN + BSN */}
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <Kv label="Geboortedatum" v={detail.medewerker.geboortedatum} />
                    <Kv label="Telefoon" v={detail.medewerker.telefoon} />
                    <Kv label="Adres" v={detail.medewerker.straat ? `${detail.medewerker.straat} ${detail.medewerker.huisnummer ?? ""}` : null} />
                    <Kv label="Postcode + plaats" v={detail.medewerker.postcode ? `${detail.medewerker.postcode} ${detail.medewerker.woonplaats ?? ""}` : null} />
                    <Kv label="IBAN" v={detail.medewerker.iban} mono />
                    <Kv label="BSN" v={detail.medewerker.bsn} mono />
                  </div>

                  {/* Documenten */}
                  {detail.documenten.length === 0 ? (
                    <p className="text-[12px]" style={{ color: "var(--muted)" }}>Nog geen documenten geüpload.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.documenten.map((d) => (
                        <li key={d.id} className="rounded-md p-2 flex items-center justify-between gap-2 flex-wrap"
                            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                              {TYPE_LABELS[d.type] ?? d.type}
                              {d.goedgekeurd && (
                                <span className="ml-2 text-[10px]" style={{ color: "#30B26F" }}>
                                  ✓ gekeurd door {d.goedgekeurdDoor}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                              {new Date(d.geuploadOp).toLocaleString("nl-NL")} · {(d.grootteBytes / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <a
                              href={`/api/medewerker/document/${d.id}/inhoud`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[11px] px-2 py-1 rounded-md"
                              style={{ background: hex, color: "#fff" }}
                            >
                              👁
                            </a>
                            <button
                              onClick={() => zetGoedgekeurd(d.id, !d.goedgekeurd)}
                              className="text-[11px] px-2 py-1 rounded-md"
                              style={{
                                background: d.goedgekeurd ? "var(--bg)" : "#30B26F",
                                color: d.goedgekeurd ? "var(--text)" : "#fff",
                                border: d.goedgekeurd ? "1px solid var(--hairline)" : "none",
                              }}
                            >
                              {d.goedgekeurd ? "↶" : "✓"}
                            </button>
                            <button
                              onClick={() => verwijderDoc(d.id)}
                              className="text-[11px] px-2 py-1 rounded-md"
                              style={{ background: "var(--bg)", color: "#E5484D", border: "1px solid var(--hairline)" }}
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {fout && (
        <p className="text-[12px] mt-3" style={{ color: "#E5484D" }}>Fout: {fout}</p>
      )}
    </div>
  );
}

function Kv({ label, v, mono }: { label: string; v: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</p>
      <p className={`text-[12px] ${mono ? "tabular-nums" : ""}`} style={{ color: v ? "var(--text)" : "var(--muted)" }}>
        {v ?? "—"}
      </p>
    </div>
  );
}
