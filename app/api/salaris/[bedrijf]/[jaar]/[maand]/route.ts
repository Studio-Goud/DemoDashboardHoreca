/**
 * Salaris-maandrapport endpoint.
 *
 * GET /api/salaris/[bedrijf]/[jaar]/[maand]
 *   ?format=json (default) → JSON met rapport
 *   ?format=csv            → CSV-download (owner-only)
 *
 * Privacy-model:
 *   - owner  → volledig rapport (per medewerker uurloon + bedragen)
 *   - manager→ ALLEEN aggregaat (totaal loonkosten, totaal uren, aantal mensen)
 *              — geen per-persoon detail om privacy te beschermen
 *   - medewerker → 403
 *
 * Side-effect (owner alleen): bij elke call wordt de periode opnieuw berekend
 * en geüpdatet in `salaris_perioden`. Manager-calls zijn read-only en
 * gebruiken de huidige opgeslagen waardes.
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { genereerMaandrapport, maandrapportNaarCsv, berekenSalarisVoorBedrijf } from "@/lib/salaris";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];

export async function GET(
  req: Request,
  { params }: { params: { bedrijf: string; jaar: string; maand: string } },
) {
  const sessie = await huidigeSessie();
  if (!sessie) {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "geen toegang" }, { status: 403 });
  }

  if (!(VALID as string[]).includes(params.bedrijf)) {
    return NextResponse.json({ error: "onbekend bedrijf" }, { status: 400 });
  }
  const jaar = Number(params.jaar);
  const maand = Number(params.maand);
  if (!Number.isInteger(jaar) || jaar < 2020 || jaar > 2100) {
    return NextResponse.json({ error: "ongeldig jaar" }, { status: 400 });
  }
  if (!Number.isInteger(maand) || maand < 1 || maand > 12) {
    return NextResponse.json({ error: "ongeldige maand" }, { status: 400 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";

  // ─── MANAGER: alleen aggregaat ───────────────────────────────────────────
  if (sessie.rol === "manager") {
    if (format === "csv") {
      // Geen CSV-export voor managers (privacy)
      return NextResponse.json({ error: "CSV-export alleen voor owner" }, { status: 403 });
    }

    // Read-only berekening zonder DB-side-effects (geen slaSalarisPeriodeOp)
    try {
      const berekeningen = await berekenSalarisVoorBedrijf(params.bedrijf as Bedrijf, jaar, maand);
      const totaalLoonkosten = berekeningen.reduce((s, b) => s + b.totaalEur, 0);
      const totaalUren = berekeningen.reduce((s, b) => s + b.brutoUren, 0);
      const aantalMedewerkers = berekeningen.length;

      return NextResponse.json({
        rol: "manager",
        bedrijf: params.bedrijf,
        jaar,
        maand,
        // GEEN per-persoon detail — alleen aggregaten
        aantalMedewerkers,
        totaalUren: Math.round(totaalUren * 10) / 10,
        totaalLoonkosten: Math.round(totaalLoonkosten * 100) / 100,
        gemKostPerMedewerker: aantalMedewerkers > 0
          ? Math.round((totaalLoonkosten / aantalMedewerkers) * 100) / 100
          : 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "onbekend";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ─── OWNER: volledig rapport + side-effect (upsert salaris_perioden) ─────
  try {
    const rapport = await genereerMaandrapport(params.bedrijf as Bedrijf, jaar, maand);

    if (format === "csv") {
      const csv = maandrapportNaarCsv(rapport);
      const bestandsnaam = `salaris-${params.bedrijf}-${jaar}-${String(maand).padStart(2, "0")}.csv`;
      return new NextResponse("﻿" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
        },
      });
    }

    return NextResponse.json({ rol: "owner", ...rapport });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
