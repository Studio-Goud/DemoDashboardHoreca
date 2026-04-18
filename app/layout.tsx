import type { Metadata, Viewport } from "next";
import { Great_Vibes } from "next/font/google";
import "./globals.css";
import PinGate from "@/components/PinGate";
import LiveBalk from "@/components/LiveBalk";

const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Omzetoverzicht Studio Goud",
  description: "Business intelligence dashboard voor Studio Goud ondernemingen",
  manifest: "/manifest.json",
  applicationName: "Omzet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Omzet",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={greatVibes.variable}>
      <body className="min-h-screen">
        <PinGate>
          <LiveBalk />
          {children}
        </PinGate>
      </body>
    </html>
  );
}
