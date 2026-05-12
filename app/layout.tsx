import type { Metadata, Viewport } from "next";
import "./globals.css";
import PinGate from "@/components/PinGate";
import LiveBalk from "@/components/LiveBalk";

export const metadata: Metadata = {
  title: "Studio Goud",
  description: "Business intelligence dashboard voor Studio Goud ondernemingen",
  manifest: "/manifest.json",
  applicationName: "Studio Goud",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Studio Goud",
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
  return (
    <html lang="nl">
      <body className="min-h-screen antialiased">
        <PinGate>
          <LiveBalk />
          {children}
        </PinGate>
      </body>
    </html>
  );
}
