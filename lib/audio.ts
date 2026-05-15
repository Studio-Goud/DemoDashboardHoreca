/**
 * Subtiele synth-clicks via Web Audio API.
 *
 * Achtergrond: iOS PWA's hebben GEEN haptic feedback (navigator.vibrate
 * is no-op). Dit is een audio-substituut voor key acties — een korte
 * sine-burst (~30ms, 1500 Hz) die voelt als de Teenage Engineering
 * micro-tick. Voicemail-zacht, niet irritant. Off by default.
 *
 * Activatie: gebruiker moet expliciet aanzetten via AudioToggle (settings
 * mutation in localStorage). iOS Safari blokkeert AudioContext tot er
 * een user-gesture is geweest, dus we initialiseren lazy.
 */

const STORAGE_KEY = "sf_audio_enabled";
let ctx: AudioContext | null = null;

/**
 * Lazy AudioContext-factory. Maakt 'm pas aan bij eerste play() — iOS
 * staat 'm pas toe na een user-gesture. Server-side renderen returnt null.
 */
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Cls = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Cls) return null;
      ctx = new Cls();
    } catch {
      return null;
    }
  }
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

export function audioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setAudioEnabled(aan: boolean): void {
  if (typeof window === "undefined") return;
  if (aan) {
    localStorage.setItem(STORAGE_KEY, "1");
    // Trigger ctx-init zodat eerstvolgende play() direct werkt
    getCtx();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent("sf:audio-toggle", { detail: { aan } }));
}

interface ToonOpties {
  /** Hz, default 1500 (helder maar niet schel). */
  freq?: number;
  /** Duur in ms, default 30 (kort tikje). */
  durMs?: number;
  /** Volume 0-1, default 0.04 (heel zacht). */
  vol?: number;
  /** Wave-type, default "sine" (zacht). "triangle" voor iets bijtender. */
  type?: OscillatorType;
}

/**
 * Speel één tikje. Stil als audio uit staat. Faalt nooit — als WebAudio
 * niet beschikbaar is doet 'ie gewoon niks.
 */
export function tik(opties: ToonOpties = {}): void {
  if (!audioEnabled()) return;
  const ac = getCtx();
  if (!ac) return;

  const freq = opties.freq ?? 1500;
  const durMs = opties.durMs ?? 30;
  const vol = opties.vol ?? 0.04;
  const type = opties.type ?? "sine";

  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ac.destination);

    const now = ac.currentTime;
    const dur = durMs / 1000;
    // Korte attack, exponentiële release voor "tikje" karakter
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  } catch {
    // Stil — audio is luxe, mag nooit een actie blokkeren
  }
}

/**
 * Pre-defined cues voor consistentie. Gebruik deze ipv direct tik()
 * te roepen zodat we 1 plek hebben om de voicing te tunen.
 */
export const cues = {
  /** Standaard tap op een knop / lijst-row. */
  tap:        () => tik({ freq: 1600, durMs: 25, vol: 0.035 }),
  /** Bevestig — iets warmer (lager). */
  confirm:    () => tik({ freq: 1100, durMs: 60, vol: 0.05 }),
  /** Open modal/sheet — iets verder uit, "swoosh"-achtig. */
  open:       () => tik({ freq: 800,  durMs: 80, vol: 0.04, type: "triangle" }),
  /** Sluit modal — omgekeerd: hoger en korter. */
  close:      () => tik({ freq: 1900, durMs: 40, vol: 0.03 }),
  /** Fout — twee snelle tikjes. */
  error:      () => {
    tik({ freq: 600, durMs: 50, vol: 0.05 });
    setTimeout(() => tik({ freq: 600, durMs: 50, vol: 0.05 }), 80);
  },
  /** Succes — twee oplopende tonen. */
  success:    () => {
    tik({ freq: 1200, durMs: 50, vol: 0.04 });
    setTimeout(() => tik({ freq: 1800, durMs: 60, vol: 0.04 }), 80);
  },
};
