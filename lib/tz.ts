import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  getHours as gfHours,
  getDay as gfDay,
  parseISO,
  startOfDay,
  endOfDay,
  format as gfFormat,
  startOfMonth,
  startOfYear,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  endOfYear,
} from "date-fns";

export const NL_TZ = "Europe/Amsterdam";

// Converteert een UTC (of lokaal onbepaald) Date naar een Date waarvan
// de lokale (getHours/getDay/getMonth...) waarden de NL-waarden zijn.
export function nlDate(d: Date | string): Date {
  const date = typeof d === "string" ? parseISO(d) : d;
  return toZonedTime(date, NL_TZ);
}

// NL-bewuste hour / weekday
export function getHoursNL(d: Date | string): number {
  return gfHours(nlDate(d));
}

export function getDayNL(d: Date | string): number {
  return gfDay(nlDate(d));
}

// format een Date (UTC/unknown) als NL-lokaal met een date-fns pattern
export function formatNL(d: Date | string, pattern: string, opts?: Parameters<typeof gfFormat>[2]): string {
  return gfFormat(nlDate(d), pattern, opts);
}

// yyyy-MM-dd sleutel op basis van NL-kalenderdag
export function nlDagKey(d: Date | string): string {
  return formatNL(d, "yyyy-MM-dd");
}

// --- Periodegrenzen in NL, als UTC-ISO voor API-filtering ---

export function nlStartOfDayISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  const startLocal = startOfDay(local); // 00:00 wall clock NL
  return fromZonedTime(startLocal, NL_TZ).toISOString();
}

export function nlEndOfDayISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  const endLocal = endOfDay(local);
  return fromZonedTime(endLocal, NL_TZ).toISOString();
}

export function nlStartOfWeekISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  const startLocal = startOfWeek(local, { weekStartsOn: 1 });
  return fromZonedTime(startLocal, NL_TZ).toISOString();
}

export function nlEndOfWeekISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  const endLocal = endOfWeek(local, { weekStartsOn: 1 });
  return fromZonedTime(endLocal, NL_TZ).toISOString();
}

export function nlStartOfMonthISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  return fromZonedTime(startOfMonth(local), NL_TZ).toISOString();
}

export function nlEndOfMonthISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  return fromZonedTime(endOfMonth(local), NL_TZ).toISOString();
}

export function nlStartOfYearISO(d: Date): string {
  const local = toZonedTime(d, NL_TZ);
  return fromZonedTime(startOfYear(local), NL_TZ).toISOString();
}
