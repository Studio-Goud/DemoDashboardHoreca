import { NextResponse } from "next/server";
import {
  dienstenVandaag,
  bezettingKomendePeriode,
  type Dienst,
} from "@/lib/shiftbase";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID_BEDRIJVEN: Bedrijf[] = ["bb", "sl", "kl"];

function isBedrijf(s: string): s is Bedrijf {
  return (VALID_BEDRIJVEN as string[]).includes(s);
}

// HH:MM van nu in Europe/Amsterdam
function tijdNuAmsterdam(): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function isNu(d: Dienst, nu: string): boolean {
  return d.start <= nu && nu < d.eind;
}

export async function GET(
  _req: Request,
  { params }: { params: { bedrijf: string } },
) {
  if (!isBedrijf(params.bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  try {
    const [vandaag, komendeWeek] = await Promise.all([
      dienstenVandaag(params.bedrijf),
      bezettingKomendePeriode(params.bedrijf, 14),
    ]);

    const nu = tijdNuAmsterdam();
    const aanHetWerk = vandaag.filter((d) => isNu(d, nu));
    const nogTeKomen = vandaag.filter((d) => d.start > nu);
    const klaar = vandaag.filter((d) => d.eind <= nu);

    return NextResponse.json({
      bedrijf: params.bedrijf,
      nu,
      vandaag: {
        totaalMensen: new Set(vandaag.map((d) => d.medewerker.id)).size,
        totaalUren: Math.round(vandaag.reduce((s, d) => s + d.uren, 0) * 10) / 10,
        aanHetWerk,
        nogTeKomen,
        klaar,
      },
      komendeWeek,
      gegenereerd: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
