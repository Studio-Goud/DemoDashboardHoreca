import type { Metadata } from "next";
import { Great_Vibes } from "next/font/google";
import "./globals.css";
import PinGate from "@/components/PinGate";

const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Omzetoverzicht — Brunch & Brew · Saté Lounge",
  description: "Business intelligence dashboard voor Studio Goud ondernemingen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={greatVibes.variable}>
      <body className="min-h-screen">
        <PinGate>{children}</PinGate>
      </body>
    </html>
  );
}
