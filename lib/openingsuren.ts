import { getDay, getHours, parseISO } from "date-fns";

// getDay: 0 = zondag, 1 = maandag ... 6 = zaterdag
export const OPENINGSUREN: Record<number, { open: number; close: number; label: string }> = {
  1: { open: 10, close: 20, label: "Ma 10–20" },
  2: { open: 10, close: 20, label: "Di 10–20" },
  3: { open: 10, close: 20, label: "Wo 10–20" },
  4: { open: 10, close: 20, label: "Do 10–20" },
  5: { open: 10, close: 21, label: "Vr 10–21" },
  6: { open: 10, close: 20, label: "Za 10–20" },
  0: { open: 12, close: 18, label: "Zo 12–18" },
};

export function openingsUren(weekdag: number): { open: number; close: number } {
  return OPENINGSUREN[weekdag] ?? { open: 0, close: 0 };
}

export function isBinnenOpeningstijden(iso: string): boolean {
  const d = parseISO(iso);
  const u = OPENINGSUREN[getDay(d)];
  if (!u) return false;
  const h = getHours(d);
  return h >= u.open && h < u.close;
}

export function urenOpenOpWeekdag(weekdag: number): number {
  const u = OPENINGSUREN[weekdag];
  if (!u) return 0;
  return u.close - u.open;
}

// Totaal aantal open uren in een week (= som per weekdag)
export function totaalOpenUrenPerWeek(): number {
  return Object.values(OPENINGSUREN).reduce(
    (s, u) => s + (u.close - u.open),
    0
  );
}
