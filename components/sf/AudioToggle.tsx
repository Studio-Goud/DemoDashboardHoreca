"use client";

/**
 * Settings-control om audio-cues aan/uit te zetten. Bewaart in
 * localStorage via lib/audio.setAudioEnabled. Speelt een bevestigings-
 * tik bij aanzetten zodat de gebruiker meteen "voelt" hoe het klinkt.
 */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { audioEnabled, setAudioEnabled, cues } from "@/lib/audio";
import Toggle from "@/components/sf/Toggle";

export default function AudioToggle() {
  const [aan, setAan] = useState(false);
  const [gehydrateerd, setGehydrateerd] = useState(false);

  useEffect(() => {
    setAan(audioEnabled());
    setGehydrateerd(true);
    function onSync(e: Event) {
      const ce = e as CustomEvent<{ aan: boolean }>;
      setAan(ce.detail?.aan ?? false);
    }
    window.addEventListener("sf:audio-toggle", onSync);
    return () => window.removeEventListener("sf:audio-toggle", onSync);
  }, []);

  // Toon niets totdat we hydrateerd zijn — voorkomt flash
  if (!gehydrateerd) return null;

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-9 h-9 flex items-center justify-center rounded-sf"
        style={{
          background: "var(--sf-glass)",
          border: "1px solid var(--sf-hairline)",
          color: aan ? "var(--sf-accent)" : "var(--sf-fg-muted)",
        }}
        aria-hidden
      >
        {aan ? <Volume2 size={16} strokeWidth={1.5} /> : <VolumeX size={16} strokeWidth={1.5} />}
      </span>
      <Toggle
        checked={aan}
        onChange={(v) => {
          setAudioEnabled(v);
          setAan(v);
          if (v) {
            // Demo-tik bij aanzetten
            setTimeout(() => cues.confirm(), 50);
          }
        }}
        label="Audio cues"
        beschrijving="Subtiele tikjes bij key acties (tap, bevestigen, sluiten). Vervangt iOS haptics die niet werken in PWA."
      />
    </div>
  );
}
