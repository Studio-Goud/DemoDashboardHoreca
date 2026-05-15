"use client";

/**
 * Reviews-beheer voor owner/manager. Lijst van recente klant-reviews,
 * mogelijkheid om er één te verbergen (spam/fake) zonder hard-delete.
 * Verborgen reviews tellen niet mee in leaderboard / combinatie-analyse.
 *
 * Bevat ook de "QR-code printen" knop die naar de daily QR-pagina linkt.
 */
import { useEffect, useState } from "react";
import { MessageSquare, EyeOff, Eye, Loader2, QrCode, Star } from "lucide-react";

interface Review {
  id: number;
  bedrijfSlug: string;
  datum: string;
  sterren: number;
  tekst: string | null;
  ingediendOp: string;
  verborgen: boolean;
}

interface Props {
  bedrijfSlug: string;
  hex: string;
}

export default function ReviewsBeheer({ bedrijfSlug, hex }: Props) {
  const [rijen, setRijen] = useState<Review[] | null>(null);
  const [bezig, setBezig] = useState<number | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function laden() {
    setFout(null);
    try {
      const res = await fetch(`/api/admin/feedback-reviews?bedrijf=${bedrijfSlug}&dagen=60`);
      if (!res.ok) throw new Error("Kon reviews niet laden");
      const data = await res.json();
      setRijen(data.rijen ?? []);
    } catch (e: unknown) {
      setFout(e instanceof Error ? e.message : "Kon reviews niet laden");
    }
  }

  useEffect(() => { laden(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bedrijfSlug]);

  async function toggle(id: number, nu: boolean) {
    setBezig(id);
    try {
      const res = await fetch(`/api/admin/feedback-reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verborgen: !nu }),
      });
      if (!res.ok) throw new Error("Kon niet bijwerken");
      await laden();
    } catch (e: unknown) {
      setFout(e instanceof Error ? e.message : "Kon niet bijwerken");
    } finally {
      setBezig(null);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: hex }} />
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
            Klant-reviews
          </p>
        </div>
        <a
          href={`/${bedrijfSlug}/qr`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider"
          style={{ background: `${hex}22`, color: hex }}
        >
          <QrCode size={12} /> QR voor vandaag
        </a>
      </div>

      {fout && <p className="text-[12px] mb-2" style={{ color: "var(--sf-danger, #FF3D5C)" }}>{fout}</p>}

      {rijen === null ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: hex }} />
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>Laden…</span>
        </div>
      ) : rijen.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Nog geen reviews ontvangen. Hang de dag-QR op tafel.
        </p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {rijen.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 py-2"
              style={{
                borderBottom: "1px solid var(--card-border, rgba(255,255,255,0.06))",
                opacity: r.verborgen ? 0.4 : 1,
              }}
            >
              <div className="flex items-center gap-0.5 shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={10}
                    fill={i < r.sterren ? hex : "transparent"}
                    stroke={i < r.sterren ? hex : "var(--muted)"}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px]" style={{ color: "var(--text)" }}>
                  {r.tekst || <span style={{ color: "var(--muted)" }}>— geen toelichting —</span>}
                </p>
                <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {r.datum} · ingediend {new Date(r.ingediendOp).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(r.id, r.verborgen)}
                disabled={bezig === r.id}
                aria-label={r.verborgen ? "Weer tonen" : "Verbergen"}
                title={r.verborgen ? "Weer tonen" : "Verbergen"}
                className="p-2 shrink-0"
                style={{ color: "var(--muted)", minWidth: 36, minHeight: 36 }}
              >
                {bezig === r.id ? <Loader2 size={14} className="animate-spin" /> : (r.verborgen ? <Eye size={14} /> : <EyeOff size={14} />)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
