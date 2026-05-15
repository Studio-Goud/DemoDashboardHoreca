/**
 * Medewerker-leaderboard scoring.
 *
 * Score per medewerker over een venster (default: laatste 30 dagen):
 *   - Reviews-component: som van sterren van reviews op dagen waarop de
 *     medewerker op rooster stond in dat bedrijf. Eén review op een dag
 *     met 3 mensen telt voor alle 3. "Hele team wint."
 *   - Omzet-component: omzet/uur tijdens shifts, vergeleken met team-gemiddelde
 *     in datzelfde bedrijf in dezelfde periode. Beloont productieve uren.
 *
 * Eindscore = reviews-bijdrage (0-50) + omzet-bijdrage (0-50). 0-100 totaal.
 * Normalisatie tov de beste in het team — dus iemand is "100" alleen
 * als ze in beide componenten bovenaan staan.
 */
import { db } from "@/lib/db/client";
import { medewerkers, medewerkerDepartments, departments, rosters, feedbackReviews, sumupTransacties, zettleTransacties } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { format, subDays } from "date-fns";

export interface ScoreRij {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  reviewsPunten: number;
  reviewsAantal: number;
  gemSterren: number | null;
  omzetPerUur: number;
  gewerkteUren: number;
  reviewsBijdrage: number; // 0-50
  omzetBijdrage: number;   // 0-50
  totaalScore: number;     // 0-100
  rang: number;
}

interface BerekenOpties {
  bedrijfSlug: string;
  /** Aantal dagen terug. Default 30. */
  venster?: number;
  /** Eindpunt (default vandaag) — handig voor consistentie tussen calls. */
  tot?: Date;
}

/**
 * Berekent leaderboard voor één bedrijf. Returnt rijen gesorteerd op
 * totaalScore (hoog → laag). Medewerkers zonder enige activiteit (geen
 * shifts en geen reviews-coverage) worden uitgefilterd.
 */
export async function berekenLeaderboard(opts: BerekenOpties): Promise<ScoreRij[]> {
  const venster = opts.venster ?? 30;
  const tot = opts.tot ?? new Date();
  const van = subDays(tot, venster);
  const vanStr = format(van, "yyyy-MM-dd");
  const totStr = format(tot, "yyyy-MM-dd");

  // 1) Welk department-id hoort bij deze bedrijf-slug?
  const dept = await db.select().from(departments).where(eq(departments.slug, opts.bedrijfSlug)).limit(1);
  if (dept.length === 0) return [];
  const departmentId = dept[0].id;

  // 2) Actieve medewerkers gekoppeld aan dit department
  const teamRijen = await db
    .select({
      id: medewerkers.id,
      voornaam: medewerkers.voornaam,
      achternaam: medewerkers.achternaam,
      einddatum: medewerkers.einddatum,
    })
    .from(medewerkerDepartments)
    .innerJoin(medewerkers, eq(medewerkerDepartments.medewerkerId, medewerkers.id))
    .where(eq(medewerkerDepartments.departmentId, departmentId));

  const team = teamRijen.filter((m) => !m.einddatum || m.einddatum >= vanStr);
  if (team.length === 0) return [];

  // 3) Shifts in het venster voor dit department per medewerker
  const shiftRijen = await db
    .select({
      medewerkerId: rosters.medewerkerId,
      datum: rosters.datum,
      start: rosters.start,
      eind: rosters.eind,
      pauzeMin: rosters.pauzeMin,
    })
    .from(rosters)
    .where(
      and(
        eq(rosters.departmentId, departmentId),
        gte(rosters.datum, vanStr),
        lte(rosters.datum, totStr),
      ),
    );

  // Map medewerker → set van shift-datums + totale uren
  const urenPerMedewerker = new Map<number, number>();
  const dagenPerMedewerker = new Map<number, Set<string>>();
  for (const s of shiftRijen) {
    const uren = berekenShiftUren(s.start, s.eind, s.pauzeMin);
    urenPerMedewerker.set(s.medewerkerId, (urenPerMedewerker.get(s.medewerkerId) ?? 0) + uren);
    let set = dagenPerMedewerker.get(s.medewerkerId);
    if (!set) { set = new Set(); dagenPerMedewerker.set(s.medewerkerId, set); }
    set.add(s.datum);
  }

  // 4) Reviews in venster, niet-verborgen, per datum
  const reviewRijen = await db
    .select({ datum: feedbackReviews.datum, sterren: feedbackReviews.sterren })
    .from(feedbackReviews)
    .where(
      and(
        eq(feedbackReviews.bedrijfSlug, opts.bedrijfSlug),
        eq(feedbackReviews.verborgen, false),
        gte(feedbackReviews.datum, vanStr),
        lte(feedbackReviews.datum, totStr),
      ),
    );

  const reviewsPerDatum = new Map<string, number[]>();
  for (const r of reviewRijen) {
    let arr = reviewsPerDatum.get(r.datum);
    if (!arr) { arr = []; reviewsPerDatum.set(r.datum, arr); }
    arr.push(r.sterren);
  }

  // 5) Omzet per datum (SumUp + Zettle, alleen non-refunds, gesommeerd)
  const omzetPerDatum = await omzetPerDag(opts.bedrijfSlug, vanStr, totStr);

  // 6) Voor elke medewerker: aggregeer reviews + omzet over hun shift-dagen
  const ruw: Array<Omit<ScoreRij, "reviewsBijdrage" | "omzetBijdrage" | "totaalScore" | "rang">> = [];
  for (const m of team) {
    const dagen = dagenPerMedewerker.get(m.id) ?? new Set<string>();
    const uren = urenPerMedewerker.get(m.id) ?? 0;
    let reviewsPunten = 0;
    let reviewsAantal = 0;
    let sterrenSom = 0;
    let omzetSom = 0;
    dagen.forEach((d) => {
      const reviews = reviewsPerDatum.get(d) ?? [];
      reviewsAantal += reviews.length;
      for (const s of reviews) { reviewsPunten += s; sterrenSom += s; }
      omzetSom += omzetPerDatum.get(d) ?? 0;
    });
    const omzetPerUur = uren > 0 ? omzetSom / uren : 0;
    const gemSterren = reviewsAantal > 0 ? sterrenSom / reviewsAantal : null;
    ruw.push({
      medewerkerId: m.id,
      voornaam: m.voornaam,
      achternaam: m.achternaam,
      reviewsPunten,
      reviewsAantal,
      gemSterren,
      omzetPerUur,
      gewerkteUren: uren,
      // Iemand zonder shifts heeft geen attributie — behouden voor zichtbaarheid
    });
  }

  // 7) Normaliseer naar 0-50 per component (op basis van team-max)
  const maxReviews = ruw.reduce((m, r) => Math.max(m, r.reviewsPunten), 0);
  const maxOmzet = ruw.reduce((m, r) => Math.max(m, r.omzetPerUur), 0);
  const rijen: ScoreRij[] = ruw.map((r) => {
    const reviewsBijdrage = maxReviews > 0 ? (r.reviewsPunten / maxReviews) * 50 : 0;
    const omzetBijdrage = maxOmzet > 0 ? (r.omzetPerUur / maxOmzet) * 50 : 0;
    return {
      ...r,
      reviewsBijdrage,
      omzetBijdrage,
      totaalScore: reviewsBijdrage + omzetBijdrage,
      rang: 0,
    };
  });

  rijen.sort((a, b) => b.totaalScore - a.totaalScore);
  rijen.forEach((r, i) => { r.rang = i + 1; });

  // Filter het stille spook: 0 uren én 0 reviews-coverage
  return rijen.filter((r) => r.gewerkteUren > 0 || r.reviewsAantal > 0);
}

function berekenShiftUren(start: string, eind: string, pauzeMin: number | null): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = eind.split(":").map(Number);
  let min = (eh * 60 + em) - (sh * 60 + sm);
  if (min < 0) min += 24 * 60; // nacht-shift
  min -= pauzeMin ?? 0;
  return Math.max(0, min / 60);
}

async function omzetPerDag(bedrijfSlug: string, vanStr: string, totStr: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  // SumUp: status SUCCESSFUL, bedrag positief
  const sumup = await db
    .select({
      datum: sql<string>`to_char(${sumupTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`,
      omzet: sql<string>`COALESCE(SUM(${sumupTransacties.bedrag}), '0')`,
    })
    .from(sumupTransacties)
    .where(
      and(
        eq(sumupTransacties.bedrijf, bedrijfSlug),
        gte(sumupTransacties.timestamp, new Date(vanStr)),
        lte(sumupTransacties.timestamp, new Date(totStr + "T23:59:59")),
        eq(sumupTransacties.status, "SUCCESSFUL"),
      ),
    )
    .groupBy(sql`to_char(${sumupTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`);

  for (const r of sumup) out.set(r.datum, (out.get(r.datum) ?? 0) + Number(r.omzet));

  // Zettle: niet-refund
  const zettle = await db
    .select({
      datum: sql<string>`to_char(${zettleTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`,
      omzet: sql<string>`COALESCE(SUM(${zettleTransacties.bedrag}), '0')`,
    })
    .from(zettleTransacties)
    .where(
      and(
        eq(zettleTransacties.bedrijf, bedrijfSlug),
        gte(zettleTransacties.timestamp, new Date(vanStr)),
        lte(zettleTransacties.timestamp, new Date(totStr + "T23:59:59")),
        eq(zettleTransacties.refund, false),
      ),
    )
    .groupBy(sql`to_char(${zettleTransacties.timestamp} AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM-DD')`);

  for (const r of zettle) out.set(r.datum, (out.get(r.datum) ?? 0) + Number(r.omzet));
  return out;
}
