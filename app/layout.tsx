import type { Metadata } from "next";
import "./globals.css";
import PinGate from "@/components/PinGate";

export const metadata: Metadata = {
  title: "Omzetoverzicht — Brunch & Brew · Saté Lounge",
  description: "Business intelligence dashboard voor Studio Goud ondernemingen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen">
        <PinGate>{children}</PinGate>
      </body>
    </html>
  );
}
