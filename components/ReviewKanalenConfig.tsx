"use client";

/**
 * Owner config voor review-deeplinks per bedrijf. Voert de URL's in waar
 * klanten naartoe geleid worden vanaf de persoonlijke QR. Owner-only.
 *
 * Voorbeelden:
 *   Google: https://search.google.com/local/writereview?placeid=ChIJ...
 *   TripAdvisor: https://www.tripadvisor.com/UserReviewEdit-g188590-d...
 */
import { useEffect, useState } from "react";
import { Link2, Check, Loader2, ExternalLink } from "lucide-react";

interface Props {
  bedrijfSlug: string;
  hex: string;
}

export default function ReviewKanalenConfig({ bedrijfSlug, hex }: Props) {
  const [googleUrl, setGoogleUrl] = useState("");
  const [tripUrl, setTripUrl] = useState("");
  const [bezig, setBezig] = useState(false);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/review-kanalen?bedrijf=${bedrijfSlug}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Kon niet laden")))
      .then((d) => {
        setGoogleUrl(d.googleReviewUrl || "");
        setTripUrl(d.tripadvisorReviewUrl || "");
      })
      .catch((e) => setFout(e.message));
  }, [bedrijfSlug]);

  async function opslaan() {
    setBezig(true);
    setFout(null);
    setOpgeslagen(false);
    try {
      const res = await fetch("/api/admin/review-kanalen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedrijf: bedrijfSlug, googleReviewUrl: googleUrl, tripadvisorReviewUrl: tripUrl }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Opslaan mislukt");
      }
      setOpgeslagen(true);
      setTimeout(() => setOpgeslagen(false), 2000);
    } catch (e: unknown) {
      setFout(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={14} style={{ color: hex }} />
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: hex }}>
          Review-kanalen
        </p>
      </div>

      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Klanten worden via de persoonlijke QR van een medewerker doorgestuurd naar deze URLs. Plak hier het Google "write review"-link en/of TripAdvisor-link.
      </p>

      <label className="block mb-3">
        <span className="block font-mono text-[10px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
          Google review-URL
        </span>
        <input
          type="url"
          value={googleUrl}
          onChange={(e) => setGoogleUrl(e.target.value)}
          placeholder="https://search.google.com/local/writereview?placeid=…"
          className="w-full rounded-lg px-3 py-2.5 text-[12px] font-mono"
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.04))",
            border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
            color: "var(--text)",
          }}
        />
      </label>

      <label className="block mb-3">
        <span className="block font-mono text-[10px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
          TripAdvisor review-URL
        </span>
        <input
          type="url"
          value={tripUrl}
          onChange={(e) => setTripUrl(e.target.value)}
          placeholder="https://www.tripadvisor.com/UserReviewEdit-…"
          className="w-full rounded-lg px-3 py-2.5 text-[12px] font-mono"
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.04))",
            border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
            color: "var(--text)",
          }}
        />
      </label>

      {fout && (
        <p className="text-[12px] mb-2" style={{ color: "var(--sf-danger, #FF3D5C)" }}>{fout}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={opslaan}
          disabled={bezig}
          className="px-4 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider flex items-center gap-2"
          style={{ background: hex, color: "#000", minHeight: 36 }}
        >
          {bezig ? <Loader2 size={12} className="animate-spin" /> : opgeslagen ? <Check size={12} /> : null}
          {opgeslagen ? "Opgeslagen" : "Opslaan"}
        </button>
        <a
          href="https://www.whitespark.ca/google-review-link-generator/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
          style={{ color: "var(--muted)" }}
        >
          Google link generator <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
