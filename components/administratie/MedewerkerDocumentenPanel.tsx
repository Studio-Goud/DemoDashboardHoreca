"use client";

/**
 * Owner-review paneel voor medewerker-documenten + loonadministratie-gegevens.
 *
 * Bovenste lijstje: alle actieve medewerkers met onboarding-status. Klik op
 * één om de detail-view in te klappen met NAW + IBAN + (ontsleutelde) BSN
 * + foto's. Per foto: bekijken / goedkeuren / verwijderen.
 */
import { useEffect, useState } from "react";
import FotoViewer from "@/components/FotoViewer";

interface MedewerkerRij {
  id: number;
  voornaam: string;
  achternaam: string;
  email: string;
  onboardingVoltooid: boolean;
  goedgekeurd: boolean;
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
    goedgekeurd: boolean;
    goedgekeurdOp: string | null;
    goedgekeurdDoor: string | null;
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
  const [bekijkId, setBekijkId] = useState<number | null>(null);
  const [ingeklapt, setIngeklapt] = useState(true);

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

  async function zetMedewerkerGoedgekeurd(medewerkerId: number, goedgekeurd: boolean) {
    setFout(null);
    if (goedgekeurd && !confirm("Medewerker goedkeuren? Hij/zij kan dan rooster zien, beschikbaarheid doorgeven en gaat meelopen in de loonadministratie.")) return;
    if (!goedgekeurd && !confirm("Goedkeuring intrekken? Medewerker krijgt het wacht-scherm te zien tot je opnieuw goedkeurt.")) return;

    const res = await fetch("/api/admin/medewerker-goedkeuren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medewerkerId, goedgekeurd }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "fout" }));
      setFout(j.error || "actie mislukt");
      return;
    }
    if (openId === medewerkerId) {
      const r2 = await fetch(`/api/admin/medewerker-documenten?medewerkerId=${medewerkerId}`, { cache: "no-store" });
      if (r2.ok) setDetail(await r2.json());
    }
    laadLijst();
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

  const aantalWachtend = rijen.filter((r) => !r.goedgekeurd).length;

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setIngeklapt((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="eyebrow mb-1">Loonadministratie</p>
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            🪪 Medewerker-documenten
          </h2>
        </div>
        {aantalWachtend > 0 && ingeklapt && (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ background: "rgba(240,183,49,0.15)", color: "#B47B00" }}
          >
            {aantalWachtend} wacht
          </span>
        )}
        <span
          className="text-[18px] shrink-0 transition-transform"
          style={{ color: "var(--muted)", transform: ingeklapt ? "rotate(0deg)" : "rotate(90deg)" }}
        >
          ›
        </span>
      </button>

      {!ingeklapt && (
        <>
          <p className="text-[12px] mt-3 mb-3" style={{ color: "var(--muted)" }}>
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
                  {r.goedgekeurd ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#30B26F", color: "#fff" }}>
                      ✓ Goedgekeurd
                    </span>
                  ) : r.onboardingVoltooid ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#F0B731", color: "#fff" }}>
                      ⏳ Wacht op goedkeuring
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-elev)", color: "var(--text-2)", border: "1px solid var(--hairline)" }}>
                      Onboarding open
                    </span>
                  )}
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {r.aantalGoedgekeurd}/{r.aantalDocs} docs gekeurd
                  </p>
                </div>
              </button>

              {openId === r.id && detail && detail.medewerker.id === r.id && (
                <div className="border-t p-3 space-y-3" style={{ borderColor: "var(--hairline)", background: "var(--bg)" }}>
                  {/* Goedkeurings-actie — prominent bovenaan */}
                  <div
                    className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
                    style={{
                      background: detail.medewerker.goedgekeurd ? "rgba(48,178,111,0.08)" : "rgba(240,183,49,0.10)",
                      border: `1px solid ${detail.medewerker.goedgekeurd ? "#30B26F" : "#F0B731"}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                        {detail.medewerker.goedgekeurd ? "✓ Account is goedgekeurd" : "⏳ Account wacht op goedkeuring"}
                      </p>
                      {detail.medewerker.goedgekeurd ? (
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                          Door {detail.medewerker.goedgekeurdDoor ?? "onbekend"}
                          {detail.medewerker.goedgekeurdOp && " op " + new Date(detail.medewerker.goedgekeurdOp).toLocaleDateString("nl-NL")}
                        </p>
                      ) : (
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                          Check IBAN met bankpas-foto en BSN met ID-foto, dan goedkeuren.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => zetMedewerkerGoedgekeurd(detail.medewerker.id, !detail.medewerker.goedgekeurd)}
                      className="text-[12px] font-semibold px-4 py-2 rounded-md shrink-0"
                      style={{
                        background: detail.medewerker.goedgekeurd ? "var(--bg-elev)" : "#30B26F",
                        color: detail.medewerker.goedgekeurd ? "var(--text)" : "#fff",
                        border: detail.medewerker.goedgekeurd ? "1px solid var(--hairline)" : "none",
                      }}
                    >
                      {detail.medewerker.goedgekeurd ? "Intrekken" : "✓ Goedkeuren"}
                    </button>
                  </div>

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
                            <button
                              type="button"
                              onClick={() => setBekijkId(d.id)}
                              className="text-[11px] px-2 py-1 rounded-md"
                              style={{ background: hex, color: "#fff" }}
                            >
                              👁
                            </button>
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
        </>
      )}

      {fout && (
        <p className="text-[12px] mt-3" style={{ color: "#E5484D" }}>Fout: {fout}</p>
      )}

      {/* Shared fullscreen viewer — pinch-zoom + ESC + sci-fi styling. */}
      <FotoViewer
        documentId={bekijkId}
        onClose={() => setBekijkId(null)}
        meta={(() => {
          if (bekijkId === null || !detail) return undefined;
          const doc = detail.documenten.find((d) => d.id === bekijkId);
          if (!doc) return undefined;
          return {
            type: doc.type,
            medewerker: `${detail.medewerker.voornaam} ${detail.medewerker.achternaam}`,
            uploadDatum: new Date(doc.geuploadOp).toLocaleString("nl-NL", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          };
        })()}
      />
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
