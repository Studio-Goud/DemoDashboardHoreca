/**
 * Salaris-maandrapport endpoint.
 *
 * GET /api/salaris/[bedrijf]/[jaar]/[maand]
 *   ?format=json (default) → JSON met volledig rapport
 *   ?format=csv            → CSV-download met hash-per-regel
 *
 * Auth: owner of manager. Medewerker mag dit niet zien (privacy).
 *
 * Side-effect: bij elke call wordt de periode opnieuw berekend en
 * geüpdatet in `salaris_perioden` (tenzij status = 'afgerekend'/'uitbetaald',
 * dan blijft de oorspronkelijke waarde gefrozen).
 */
import { NextResponse } from "next/server";
import { huidigeSessie } from "@/lib/auth";
import { genereerMaandrapport, maandrapportNaarCsv } from "@/lib/salaris";
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

  try {
    const rapport = await genereerMaandrapport(params.bedrijf as Bedrijf, jaar, maand);

    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "json";

    if (format === "csv") {
      const csv = maandrapportNaarCsv(rapport);
      const bestandsnaam = `salaris-${params.bedrijf}-${jaar}-${String(maand).padStart(2, "0")}.csv`;
      // BOM voor Excel zodat ë/€/etc. correct worden weergegeven
      return new NextResponse("﻿" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
        },
      });
    }

    return NextResponse.json(rapport);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
