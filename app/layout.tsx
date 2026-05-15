import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PinGate from "@/components/PinGate";
import LiveBalk from "@/components/LiveBalk";
import BootSequence from "@/components/BootSequence";
import { TaalProvider } from "@/lib/i18n/TaalProvider";
import { getTaal, htmlLang } from "@/lib/i18n/server";

// Display font — Space Grotesk geeft de "Linear / Arc / Vision Pro" toon zonder
// de mechaniek van een gespecialiseerd display-font. Wisselt nette display-
// proporties af met genoeg leesbaarheid voor body-tekst.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

// Monospace — voor numerieke readouts, timestamps, IDs. Geeft het "system
// readout" gevoel uit het briefing-document. JetBrains Mono heeft dichte
// karakters, sterke 0/O onderscheid, en past in een sci-fi context.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Markthal HQ",
  description: "Business intelligence dashboard voor Markthal HQ ondernemingen",
  manifest: "/manifest.json",
  applicationName: "Markthal HQ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Markthal HQ",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
    { media: "(prefers-color-scheme: dark)",  color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  // viewportFit: "cover" is verplicht voor iOS Safari om env(safe-area-inset-*)
  // values bloot te leggen. Zonder dit evalueren alle safe-area-padding-bottom
  // hints (bottom-nav medewerker, foto-modals) naar 0 — nav valt over de
  // home-indicator. NIET userScalable=false zetten (WCAG 1.4.4: blokkeert
  // pinch-zoom voor slechtziende gebruikers).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const taal = getTaal();
  return (
    <html lang={htmlLang(taal)} className={`${grotesk.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <TaalProvider initieelTaal={taal}>
          {/* Boot-sequence sit als fixed overlay (z-100). Speelt elke
              keer dat de app fresh mount (hard refresh, nieuwe tab,
              cold open). Skipt op /dev/*, /m/*, /welkom*. Soft-nav
              triggert niet — children mount maar 1x. */}
          <BootSequence />
          <PinGate>
            <LiveBalk />
            {children}
          </PinGate>
        </TaalProvider>
      </body>
    </html>
  );
}
