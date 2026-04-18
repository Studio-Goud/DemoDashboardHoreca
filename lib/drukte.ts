import type { Bedrijf } from "./sumup";

export type DrukLevel = "laag" | "normaal" | "druk" | "zeer druk" | "gesloten";

// Omzet-drempels per bedrijf (incl. BTW).
// Onder "normaal" = laag, daarboven schaalt het naar druk/zeer druk.
export const DRUKTE_GRENS: Record<
  Bedrijf,
  { normaal: number; druk: number; zeerDruk: number }
> = {
  bb: { normaal: 800,  druk: 1300, zeerDruk: 1600 },
  sl: { normaal: 550,  druk: 900,  zeerDruk: 1200 },
  // Placeholder — tune deze drempels voor Het Kroket Loket zodra je een
  // gevoel hebt bij drukke/rustige dagen. Laat het weten dan pas ik aan.
  kl: { normaal: 400,  druk: 700,  zeerDruk: 1000 },
};

export function drukteVoorOmzet(
  omzet: number,
  bedrijf: Bedrijf
): DrukLevel {
  const g = DRUKTE_GRENS[bedrijf];
  if (omzet >= g.zeerDruk) return "zeer druk";
  if (omzet >= g.druk) return "druk";
  if (omzet >= g.normaal) return "normaal";
  return "laag";
}

export function drukteLabel(niveau: DrukLevel): string {
  switch (niveau) {
    case "zeer druk": return "Zeer druk";
    case "druk":      return "Druk";
    case "normaal":   return "Normaal";
    case "laag":      return "Rustig";
    case "gesloten":  return "Gesloten";
  }
}
