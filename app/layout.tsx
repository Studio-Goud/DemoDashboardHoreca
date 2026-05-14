import type { Metadata, Viewport } from "next";
import "./globals.css";
import PinGate from "@/components/PinGate";
import LiveBalk from "@/components/LiveBalk";
import TaalFloater from "@/components/TaalFloater";
import { TaalProvider } from "@/lib/i18n/TaalProvider";
import { getTaal, htmlLang } from "@/lib/i18n/server";

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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const taal = getTaal();
  return (
    <html lang={htmlLang(taal)}>
      <body className="min-h-screen antialiased">
        <TaalProvider initieelTaal={taal}>
          <PinGate>
            <LiveBalk />
            {children}
            <TaalFloater />
          </PinGate>
        </TaalProvider>
      </body>
    </html>
  );
}
