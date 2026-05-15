/**
 * Personeel-prestaties per maand. Omzet wordt op tijd-basis verdeeld:
 * elke transactie (SumUp + Zettle) wordt toegerekend aan de medewerker(s)
 * die op dat moment volgens het rooster werkten — gelijke verdeling over
 * aanwezigen. Approximatie, maar goed genoeg voor trends en functionerings-
 * gesprekken zonder dat we een echte kassier-ID per transactie hebben.
 *
 * Output per medewerker:
 *  - uren (uit rosters in de maand)
 *  - toegerekende omzet
 *  - aantal transacties
 *  - gem. bonbedrag (= omzet / aantal)
 *  - omzet per uur
 *
 * Plus team-gemiddelde voor benchmarks.
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "./db/client";
import { fetchAllZettlePurchases, type Bedrijf } from "./zettle";

export type BedrijfSlug = "bb" | "sl" | "kl";

export interface PrestatieRegel {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  uren: number;
  omzet: number;
  transacties: number;
  gemBonbedrag: number;
  omzetPerUur: number;
}

export interface PrestatieRapport {
  bedrijf: BedrijfSlug;
  jaar: number;
  maand: number;
  perMedewerker: PrestatieRegel[];
  teamGemiddelden: {
    omzetPerUur: number;
    gemBonbedrag: number;
  };
  totaal: {
    uren: number;
    omzet: number;
    transacties: number;
  };
}

interface ShiftWindow {
  medewerkerId: number;
  voornaam: string;
  achternaam: string;
  /** UTC ms timestamp. */
  startMs: number;
  eindMs: number;
  uren: number;
}

const NL_TZ = "Europe/Amsterdam";

/**
 * Combineer datum (YYYY-MM-DD) + tijd (HH:MM) als NL-lokale moment en
 * retourneer als UTC ms. Houdt rekening met zomertijd.
 */
function nlDatumTijdNaarMs(datum: string, tijd: string): number {
  // We bouwen een ISO-string zonder TZ en interpreteren die als NL-tijd
  const iso = `${datum}T${tijd}:00`;
  // Trick: parse als UTC, dan via NL-offset corrigeren is foutgevoelig.
  // Gebruik Date constructor met "Z" als ankerpunt en correct offset:
  const dummy = new Date(`${iso}Z`);
  // Bereken NL-offset op die datum
  const nl = new Date(dummy.toLocaleString("en-US", { timeZone: NL_TZ }));
  const offset = dummy.getTime() - nl.getTime();
  return dummy.getTime() + offset;
}

async function shiftsInPeriode(
  bedrijf: BedrijfSlug,
  startDatum: string,
  eindDatum: string,
): Promise<ShiftWindow[]> {
  const [{ id: deptId } = { id: -1 }] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, bedrijf));
  if (deptId === -1) return [];

  const rijen = await db
    .select({
      medewerkerId: schema.medewerkers.id,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
      datum: schema.rosters.datum,
      start: schema.rosters.start,
      eind: schema.rosters.eind,
      pauzeMin: schema.rosters.pauzeMin,
    })
    .from(schema.rosters)
    .innerJoin(schema.medewerkers, eq(schema.rosters.medewerkerId, schema.medewerkers.id))
    .where(and(
      eq(schema.rosters.departmentId, deptId),
      gte(schema.rosters.datum, startDatum),
      // Half-open [start, eind) — caller geeft eindDatum als 1e van volgende
      // maand. lt voorkomt dat die dag dubbel telt in twee maand-rapporten.
      lt(schema.rosters.datum, eindDatum),
    ));

  return rijen
    .map((r) => {
      const startMs = nlDatumTijdNaarMs(r.datum, String(r.start).slice(0, 5));
      const eindMs = nlDatumTijdNaarMs(r.datum, String(r.eind).slice(0, 5));
      const minuten = Math.max(0, (eindMs - startMs) / 60000 - (r.pauzeMin ?? 0));
      return {
        medewerkerId: r.medewerkerId,
        voornaam: r.voornaam,
        achternaam: r.achternaam,
        startMs,
        eindMs,
        uren: minuten / 60,
      };
    })
    .filter((s) => s.uren > 0);
}

async function transactiesInPeriode(
  bedrijf: BedrijfSlug,
  startMs: number,
  eindMs: number,
): Promise<Array<{ ts: number; bedrag: number }>> {
  // SumUp uit Postgres (sumup_transacties)
  const sumupRijen = await db
    .select({
      bedrag: schema.sumupTransacties.bedrag,
      timestamp: schema.sumupTransacties.timestamp,
    })
    .from(schema.sumupTransacties)
    .where(and(
      eq(schema.sumupTransacties.bedrijf, bedrijf),
      gte(schema.sumupTransacties.timestamp, new Date(startMs)),
      lt(schema.sumupTransacties.timestamp, new Date(eindMs)),
    ));

  const sumupTxs = sumupRijen
    .filter((r) => Number(r.bedrag) > 0)
    .map((r) => ({ ts: r.timestamp.getTime(), bedrag: Number(r.bedrag) }));

  // Zettle (via DB-snapshot of API fallback)
  let zettleTxs: Array<{ ts: number; bedrag: number }> = [];
  try {
    const purchases = await fetchAllZettlePurchases(bedrijf as Bedrijf);
    zettleTxs = purchases
      .filter((p) => !p.refund)
      .map((p) => ({ ts: Date.parse(p.timestamp), bedrag: p.amount / 100 }))
      .filter((t) => t.ts >= startMs && t.ts <= eindMs && t.bedrag > 0);
  } catch {
    // Zettle niet beschikbaar — alleen SumUp gebruiken
  }

  return [...sumupTxs, ...zettleTxs].sort((a, b) => a.ts - b.ts);
}

export async function prestatiesPerMaand(
  bedrijf: BedrijfSlug,
  jaar: number,
  maand: number,
): Promise<PrestatieRapport> {
  const startDatum = `${jaar}-${String(maand).padStart(2, "0")}-01`;
  const eindMaand = maand === 12 ? 1 : maand + 1;
  const eindJaar = maand === 12 ? jaar + 1 : jaar;
  const eindDatumStr = `${eindJaar}-${String(eindMaand).padStart(2, "0")}-01`;

  const startMs = nlDatumTijdNaarMs(startDatum, "00:00");
  const eindMs = nlDatumTijdNaarMs(eindDatumStr, "00:00");

  // Haal shifts + transacties parallel
  const [shifts, txs] = await Promise.all([
    shiftsInPeriode(bedrijf, startDatum, eindDatumStr),
    transactiesInPeriode(bedrijf, startMs, eindMs),
  ]);

  // Per medewerker accumulator
  const acc = new Map<number, {
    voornaam: string;
    achternaam: string;
    uren: number;
    omzet: number;
    transacties: number;
  }>();

  // Eerst uren per medewerker
  for (const s of shifts) {
    const huidig = acc.get(s.medewerkerId) ?? {
      voornaam: s.voornaam, achternaam: s.achternaam, uren: 0, omzet: 0, transacties: 0,
    };
    huidig.uren += s.uren;
    acc.set(s.medewerkerId, huidig);
  }

  // Voor elke transactie: zoek de medewerker(s) wiens shift dat moment dekt.
  // Verdeel gelijk over aanwezigen.
  for (const tx of txs) {
    const aanwezigen = shifts.filter((s) => tx.ts >= s.startMs && tx.ts <= s.eindMs);
    if (aanwezigen.length === 0) continue; // geen rooster gevonden — sla over
    const deel = tx.bedrag / aanwezigen.length;
    const txDeel = 1 / aanwezigen.length;
    for (const a of aanwezigen) {
      const huidig = acc.get(a.medewerkerId);
      if (!huidig) continue;
      huidig.omzet += deel;
      huidig.transacties += txDeel;
    }
  }

  const perMedewerker: PrestatieRegel[] = Array.from(acc.entries())
    .map(([medewerkerId, v]) => ({
      medewerkerId,
      voornaam: v.voornaam,
      achternaam: v.achternaam,
      uren: Math.round(v.uren * 10) / 10,
      omzet: Math.round(v.omzet * 100) / 100,
      transacties: Math.round(v.transacties),
      gemBonbedrag: v.transacties > 0 ? Math.round((v.omzet / v.transacties) * 100) / 100 : 0,
      omzetPerUur: v.uren > 0 ? Math.round((v.omzet / v.uren) * 100) / 100 : 0,
    }))
    .filter((r) => r.uren > 0)
    .sort((a, b) => b.omzetPerUur - a.omzetPerUur);

  const totUren = perMedewerker.reduce((s, r) => s + r.uren, 0);
  const totOmzet = perMedewerker.reduce((s, r) => s + r.omzet, 0);
  const totTxs = perMedewerker.reduce((s, r) => s + r.transacties, 0);

  const teamGemiddelden = {
    omzetPerUur: totUren > 0 ? Math.round((totOmzet / totUren) * 100) / 100 : 0,
    gemBonbedrag: totTxs > 0 ? Math.round((totOmzet / totTxs) * 100) / 100 : 0,
  };

  return {
    bedrijf, jaar, maand,
    perMedewerker,
    teamGemiddelden,
    totaal: {
      uren: Math.round(totUren * 10) / 10,
      omzet: Math.round(totOmzet * 100) / 100,
      transacties: Math.round(totTxs),
    },
  };
}
