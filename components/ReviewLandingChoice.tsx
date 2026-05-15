"use client";

/**
 * Klant-landing met 2 platform-knoppen. Klik registreert door-klik via
 * /api/r/[token]/click en redirect naar review-URL. Op de telefoon
 * herkent Google/TripAdvisor de ingelogde sessie zodat het review-form
 * direct opent — geen extra login.
 */
import { Star, ExternalLink } from "lucide-react";

interface Props {
  token: string;
  voornaam: string;
  bedrijfNaam: string;
  hex: string;
  googleUrl: string;
  tripadvisorUrl: string;
}

export default function ReviewLandingChoice({ token, voornaam, bedrijfNaam, hex, googleUrl, tripadvisorUrl }: Props) {
  function open(platform: "google" | "tripadvisor", url: string) {
    if (!url) return;
    // Fire-and-forget: registreer keuze. Klant ziet geen wachtmoment —
    // we navigeren direct daarna.
    fetch(`/api/r/${token}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
      keepalive: true,
    }).catch(() => null);
    window.location.href = url;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg, #08090C)" }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `${hex}22`, color: hex }}
          >
            <Star size={32} fill={hex} stroke={hex} />
          </div>
        </div>

        <p
          className="font-mono text-[10px] tracking-[0.32em] uppercase mb-2"
          style={{ color: hex }}
        >
          Bedankt voor je bezoek
        </p>
        <h1
          className="font-display text-[26px] font-semibold tracking-tight mb-2"
          style={{ color: "var(--text, #E8ECF4)" }}
        >
          Help {voornaam} aan een review
        </h1>
        <p className="text-[14px] mb-8" style={{ color: "var(--muted, #8A8F9C)" }}>
          Kies waar je {bedrijfNaam} wil reviewen — duurt 30 seconden, je bent al ingelogd.
        </p>

        <div className="space-y-3">
          {googleUrl && (
            <button
              type="button"
              onClick={() => open("google", googleUrl)}
              className="w-full py-4 rounded-xl font-mono text-[13px] uppercase tracking-wider flex items-center justify-center gap-2"
              style={{ background: "#fff", color: "#000", minHeight: 56 }}
            >
              <GoogleLogo /> Review op Google
              <ExternalLink size={14} />
            </button>
          )}
          {tripadvisorUrl && (
            <button
              type="button"
              onClick={() => open("tripadvisor", tripadvisorUrl)}
              className="w-full py-4 rounded-xl font-mono text-[13px] uppercase tracking-wider flex items-center justify-center gap-2"
              style={{ background: "#00AF87", color: "#fff", minHeight: 56 }}
            >
              <TripadvisorLogo /> Review op TripAdvisor
              <ExternalLink size={14} />
            </button>
          )}
          {!googleUrl && !tripadvisorUrl && (
            <p className="text-[12px]" style={{ color: "var(--sf-danger, #FF3D5C)" }}>
              Er is nog geen review-link ingesteld voor dit bedrijf.
            </p>
          )}
        </div>

        <p className="text-[10px] mt-8" style={{ color: "var(--muted, #8A8F9C)" }}>
          {bedrijfNaam} · scan via {voornaam}
        </p>
      </div>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"/>
    </svg>
  );
}

function TripadvisorLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <circle cx="8" cy="13" r="3.2" fill="#000" />
      <circle cx="16" cy="13" r="3.2" fill="#000" />
      <circle cx="8" cy="13" r="1" fill="#fff" />
      <circle cx="16" cy="13" r="1" fill="#fff" />
    </svg>
  );
}
