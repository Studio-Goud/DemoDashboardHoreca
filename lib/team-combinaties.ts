/**
 * Team-combinatie analyse — voor elk paar medewerkers berekent dit hoe
 * vaak ze samen werkten en welke gemiddelde review-score / omzet/uur die
 * gezamenlijke shifts opleverden.
 *
 * Owner gebruikt dit signaal om te zien welke duo's structureel onder
 * gemiddelde leveren — en kan daar later het rooster op aanpassen.
 * Phase A: alleen tonen. Phase C (toekomst): rooster-auto.ts gewicht.
 */
import { db } from "@/lib/db/client";
import { medewerkers, departments, rosters, reviewReferrals, sumupTransacties, zettleTransacties } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { unstable_cache } from "next/cache";

export interface CombiRij {
  aId: number;
  bId: number;
  aNaam: string;
  bNaam: string;
  shiftsSamen: number;
  reviewsAantal: number;
  gemSterren: number | null;
  omzetPerUur: number;
  /** Z-score t.o.v. team-gemiddelde — negatief = onder, positief = boven. */
  zScore: number;
}

interface BerekenOpties {
  bedrijfSlug: string;
  venster?: number;
  /** Minimum gezamenlijke shifts om mee te tellen (anders ruis). Default 3. */
  minShifts?: number;
}

/**
 * Returnt alle paren met ≥ minShifts gezamenlijke shifts, gesorteerd op
 * zScore (slechtste eerst — daar zit de actionable info).
 *
 * Gecached 10 min — paar-analyse hoeft écht niet realtime.
 */
export const berekenCombinaties = unstable_cache(
  berekenCombinatiesUncached,
  ["team-combinaties-v1"],
  { revalidate: 600, tags: ["leaderboard"] },
);

async function berekenCombinatiesUncached(opts: BerekenOpties): Promise<CombiRij[]> {
  const venster = opts.venster ?? 60;
  const minShifts = opts.minShifts ?? 3;
  const tot = new Date();
  const van = subDays(tot, venster);
  const vanStr = format(van, "yyyy-MM-dd");
  const totStr = format(tot, "yyyy-MM-dd");

  const dept = await db.select().from(departments).where(eq(departments.slug, opts.bedrijfSlug)).limit(1);
  if (dept.length === 0) return [];
  const departmentId = dept[0].id;

  // Shifts in venster — alleen medewerkers gekoppeld aan dit dept
  const shifts = await db
    .select({
      medewerkerId: rosters.medewerkerId,
      datum: rosters.datum,
      start: rosters.start,
      eind: rosters.eind,
      pauzeMin: rosters.pauzeMin,
      voornaam: medewerkers.voornaam,
      achternaam: medewerkers.achternaam,
    })
    .from(rosters)
    .innerJoin(medewerkers, eq(rosters.medewerkerId, medewerkers.id))
    .where(and(
      eq(rosters.departmentId, departmentId),
      gte(rosters.datum, vanStr),
      lte(rosters.datum, totStr),
    ));

  // Groep shifts per datum → wie werkte er samen?
  const shiftsPerDatum = new Map<string, typeof shifts>();
  for (const s of shifts) {
    let arr = shiftsPerDatum.get(s.datum);
    if (!arr) { arr = []; shiftsPerDatum.set(s.datum, arr); }
    arr.push(s);
  }

  // Review-referrals per (medewerker, datum) — persoonlijk
  const refRijen = await db
    .select({
      medewerkerId: reviewReferrals.medewerkerId,
      datum: reviewReferrals.datum,
      status: reviewReferrals.status,
    })
    .from(reviewReferrals)
    .where(and(
      eq(reviewReferrals.bedrijfSlug, opts.bedrijfSlug),
      gte(reviewReferrals.datum, vanStr),
      lte(reviewReferrals.datum, totStr),
    ));
  // Per (medewerker, datum) → punten (scan=1, klik=5)
  const puntenPerMD = new Map<string, number>();
  for (const r of refRijen) {
    const key = `${r.medewerkerId}|${r.datum}`;
    const punten = r.status === "scan" ? 1 : 5;
    puntenPerMD.set(key, (puntenPerMD.get(key) ?? 0) + punten);
  }

  // Omzet per dag
  const omzetPerDatum = await omzetPerDag(opts.bedrijfSlug, vanStr, totStr);

  // Voor elk paar in elke dag: accumuleer shifts, review-punten, omzet
  type PaarKey = string; // "aId-bId" met aId < bId
  const paarStats = new Map<PaarKey, {
    aId: number; bId: number; aNaam: string; bNaam: string;
    shifts: number; reviewPunten: number; reviewAantal: number;
    omzet: number; uren: number;
  }>();

  shiftsPerDatum.forEach((dagShifts, datum) => {
    if (dagShifts.length < 2) return;
    const dagOmzet = omzetPerDatum.get(datum) ?? 0;
    const teamUrenDag = dagShifts.reduce(
      (s: number, sh: typeof dagShifts[number]) => s + berekenShiftUren(sh.start, sh.eind, sh.pauzeMin),
      0,
    );
    for (let i = 0; i < dagShifts.length; i++) {
      for (let j = i + 1; j < dagShifts.length; j++) {
        const a = dagShifts[i].medewerkerId < dagShifts[j].medewerkerId ? dagShifts[i] : dagShifts[j];
        const b = dagShifts[i].medewerkerId < dagShifts[j].medewerkerId ? dagShifts[j] : dagShifts[i];
        const key = `${a.medewerkerId}-${b.medewerkerId}`;
        let stat = paarStats.get(key);
        if (!stat) {
          stat = {
            aId: a.medewerkerId,
            bId: b.medewerkerId,
            aNaam: `${a.voornaam} ${a.achternaam}`,
            bNaam: `${b.voornaam} ${b.achternaam}`,
            shifts: 0, reviewPunten: 0, reviewAantal: 0, omzet: 0, uren: 0,
          };
          paarStats.set(key, stat);
        }
        stat.shifts += 1;
        // Som review-punten van beide medewerkers op deze datum
        const punA = puntenPerMD.get(`${a.medewerkerId}|${datum}`) ?? 0;
        const punB = puntenPerMD.get(`${b.medewerkerId}|${datum}`) ?? 0;
        stat.reviewPunten += punA + punB;
        if (punA > 0) stat.reviewAantal += 1;
        if (punB > 0) stat.reviewAantal += 1;
        const aUren = berekenShiftUren(a.start, a.eind, a.pauzeMin);
        const bUren = berekenShiftUren(b.start, b.eind, b.pauzeMin);
        const overlap = Math.min(aUren, bUren);
        stat.uren += overlap;
        stat.omzet += teamUrenDag > 0 ? dagOmzet * (overlap / teamUrenDag) : 0;
      }
    }
  });

  // Filter op minShifts
  const rijenRuw = Array.from(paarStats.values()).filter((s) => s.shifts >= minShifts);
  if (rijenRuw.length === 0) return [];

  // Compose CombiRij + z-scores
  const omzetUur = rijenRuw.map((s) => s.uren > 0 ? s.omzet / s.uren : 0);
  const reviewsPerShift = rijenRuw.map((s) => s.shifts > 0 ? s.reviewPunten / s.shifts : 0);
  const meanOmzet = mean(omzetUur);
  const sdOmzet = stdDev(omzetUur, meanOmzet);
  const meanReviews = mean(reviewsPerShift);
  const sdReviews = stdDev(reviewsPerShift, meanReviews);

  const rijen: CombiRij[] = rijenRuw.map((s, i) => {
    const zOmzet = sdOmzet > 0 ? (omzetUur[i] - meanOmzet) / sdOmzet : 0;
    const zReviews = sdReviews > 0 ? (reviewsPerShift[i] - meanReviews) / sdReviews : 0;
    // Combinatie-z: 60% reviews, 40% omzet (klant-signaal weegt zwaarder)
    const zScore = (zReviews * 0.6) + (zOmzet * 0.4);
    return {
      aId: s.aId,
      bId: s.bId,
      aNaam: s.aNaam,
      bNaam: s.bNaam,
      shiftsSamen: s.shifts,
      reviewsAantal: s.reviewAantal,
      gemSterren: null,
      omzetPerUur: omzetUur[i],
      zScore,
    };
  });

  rijen.sort((a, b) => a.zScore - b.zScore); // slechtste eerst
  return rijen;
}

function berekenShiftUren(start: string, eind: string, pauzeMin: number | null): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = eind.split(":").map(Number);
  let min = (eh * 60 + em) - (sh * 60 + sm);
  if (min < 0) min += 24 * 60;
  min -= pauzeMin ?? 0;
  return Math.max(0, min / 60);
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

async function omzetPerDag(bedrijfSlug: string, vanStr: string, totStr: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const sumup = await db
    .select({
      datum: sql<string>`to_char(${sumupTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`,
      omzet: sql<string>`COALESCE(SUM(${sumupTransacties.bedrag}), '0')`,
    })
    .from(sumupTransacties)
    .where(and(
      eq(sumupTransacties.bedrijf, bedrijfSlug),
      gte(sumupTransacties.timestamp, new Date(vanStr)),
      lte(sumupTransacties.timestamp, new Date(totStr + "T23:59:59")),
      eq(sumupTransacties.status, "SUCCESSFUL"),
    ))
    .groupBy(sql`to_char(${sumupTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`);
  for (const r of sumup) out.set(r.datum, (out.get(r.datum) ?? 0) + Number(r.omzet));

  const zettle = await db
    .select({
      datum: sql<string>`to_char(${zettleTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`,
      omzet: sql<string>`COALESCE(SUM(${zettleTransacties.bedrag}), '0')`,
    })
    .from(zettleTransacties)
    .where(and(
      eq(zettleTransacties.bedrijf, bedrijfSlug),
      gte(zettleTransacties.timestamp, new Date(vanStr)),
      lte(zettleTransacties.timestamp, new Date(totStr + "T23:59:59")),
      eq(zettleTransacties.refund, false),
    ))
    .groupBy(sql`to_char(${zettleTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`);
  for (const r of zettle) out.set(r.datum, (out.get(r.datum) ?? 0) + Number(r.omzet));
  return out;
}
