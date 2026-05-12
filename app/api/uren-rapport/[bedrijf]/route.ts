import { NextResponse } from "next/server";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { Bedrijf } from "@/lib/sumup";

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];

function urenUitTijd(start: string, eind: string, pauzeMin: number): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = eind.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm - (pauzeMin ?? 0)) / 60);
}

function eersteVanMaand(jaar: number, maand: number): string {
  return `${jaar}-${String(maand).padStart(2, "0")}-01`;
}
function laatsteVanMaand(jaar: number, maand: number): string {
  const dag = new Date(jaar, maand, 0).getDate();
  return `${jaar}-${String(maand).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  req: Request,
  { params }: { params: { bedrijf: string } },
) {
  if (!(VALID as string[]).includes(params.bedrijf)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  const url = new URL(req.url);
  const maand = url.searchParams.get("maand"); // "YYYY-MM"
  const formaat = url.searchParams.get("formaat") ?? "json"; // "json" | "csv"

  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return NextResponse.json({ error: "maand moet YYYY-MM zijn" }, { status: 400 });
  }
  const [jaar, maandNr] = maand.split("-").map(Number);

  try {
    // Department-id ophalen
    const dept = await db.select().from(schema.departments)
      .where(eq(schema.departments.slug, params.bedrijf));
    if (dept.length === 0) {
      return NextResponse.json({ error: "department niet gevonden" }, { status: 404 });
    }
    const deptId = dept[0].id;

    const start = eersteVanMaand(jaar, maandNr);
    const eind  = laatsteVanMaand(jaar, maandNr);

    // Diensten van die maand voor dit bedrijf (alleen gepubliceerd)
    const rows = await db.select({
      r_id: schema.rosters.id,
      r_datum: schema.rosters.datum,
      r_start: schema.rosters.start,
      r_eind: schema.rosters.eind,
      r_pauze: schema.rosters.pauzeMin,
      m_id: schema.medewerkers.id,
      m_voornaam: schema.medewerkers.voornaam,
      m_achternaam: schema.medewerkers.achternaam,
      m_uurloon: schema.medewerkers.uurloon,
      m_vakantiegeld: schema.medewerkers.vakantiegeldPct,
      m_vakantieUren: schema.medewerkers.vakantieUrenPct,
    })
      .from(schema.rosters)
      .innerJoin(schema.medewerkers, eq(schema.rosters.medewerkerId, schema.medewerkers.id))
      .where(and(
        eq(schema.rosters.departmentId, deptId),
        eq(schema.rosters.gepubliceerd, true),
        gte(schema.rosters.datum, start),
        lte(schema.rosters.datum, eind),
      ))
      .orderBy(asc(schema.medewerkers.voornaam), asc(schema.rosters.datum));

    // Aggregeer per medewerker
    const perMw = new Map<number, {
      id: number;
      voornaam: string;
      achternaam: string;
      uurloon: number | null;
      vakantiegeldPct: number;
      vakantieUrenPct: number;
      uren: number;
      aantalDiensten: number;
    }>();

    for (const r of rows) {
      const uren = urenUitTijd(r.r_start.slice(0, 5), r.r_eind.slice(0, 5), r.r_pauze ?? 0);
      const huidig = perMw.get(r.m_id) ?? {
        id: r.m_id,
        voornaam: r.m_voornaam,
        achternaam: r.m_achternaam,
        uurloon: r.m_uurloon === null ? null : Number(r.m_uurloon),
        vakantiegeldPct: r.m_vakantiegeld === null ? 8.33 : Number(r.m_vakantiegeld),
        vakantieUrenPct: r.m_vakantieUren === null ? 8.00 : Number(r.m_vakantieUren),
        uren: 0,
        aantalDiensten: 0,
      };
      huidig.uren += uren;
      huidig.aantalDiensten += 1;
      perMw.set(r.m_id, huidig);
    }

    // Bereken loon per medewerker
    const regels = Array.from(perMw.values()).map((m) => {
      const basisLoon       = m.uurloon !== null ? m.uren * m.uurloon : 0;
      const vakantiegeld    = basisLoon * (m.vakantiegeldPct / 100);
      const vakantieUren    = basisLoon * (m.vakantieUrenPct / 100);
      const totaalBruto     = basisLoon + vakantiegeld + vakantieUren;
      return {
        id: m.id,
        voornaam: m.voornaam,
        achternaam: m.achternaam,
        gewerkteUren: Math.round(m.uren * 100) / 100,
        aantalDiensten: m.aantalDiensten,
        uurloon: m.uurloon,
        vakantiegeldPct: m.vakantiegeldPct,
        vakantieUrenPct: m.vakantieUrenPct,
        basisLoon:    Math.round(basisLoon * 100) / 100,
        vakantiegeld: Math.round(vakantiegeld * 100) / 100,
        vakantieUren: Math.round(vakantieUren * 100) / 100,
        totaalBruto:  Math.round(totaalBruto * 100) / 100,
      };
    }).sort((a, b) => a.voornaam.localeCompare(b.voornaam));

    const totalen = regels.reduce((acc, r) => ({
      uren: acc.uren + r.gewerkteUren,
      diensten: acc.diensten + r.aantalDiensten,
      basisLoon: acc.basisLoon + r.basisLoon,
      vakantiegeld: acc.vakantiegeld + r.vakantiegeld,
      vakantieUren: acc.vakantieUren + r.vakantieUren,
      totaalBruto: acc.totaalBruto + r.totaalBruto,
    }), { uren: 0, diensten: 0, basisLoon: 0, vakantiegeld: 0, vakantieUren: 0, totaalBruto: 0 });

    if (formaat === "csv") {
      const headers = [
        "Voornaam", "Achternaam", "Gewerkte uren", "Aantal diensten",
        "Uurloon (€)", "Vakantiegeld %", "Vakantie-uren %",
        "Basisloon (€)", "Vakantiegeld (€)", "Vakantie-uren (€)", "Totaal bruto (€)",
      ];
      const lines = [headers.map(escapeCsv).join(";")];
      for (const r of regels) {
        lines.push([
          r.voornaam, r.achternaam,
          r.gewerkteUren.toFixed(2).replace(".", ","),
          r.aantalDiensten,
          r.uurloon !== null ? r.uurloon.toFixed(2).replace(".", ",") : "",
          r.vakantiegeldPct.toFixed(2).replace(".", ","),
          r.vakantieUrenPct.toFixed(2).replace(".", ","),
          r.basisLoon.toFixed(2).replace(".", ","),
          r.vakantiegeld.toFixed(2).replace(".", ","),
          r.vakantieUren.toFixed(2).replace(".", ","),
          r.totaalBruto.toFixed(2).replace(".", ","),
        ].map(escapeCsv).join(";"));
      }
      // Totalenregel
      lines.push([
        "TOTAAL", "",
        totalen.uren.toFixed(2).replace(".", ","),
        totalen.diensten,
        "", "", "",
        totalen.basisLoon.toFixed(2).replace(".", ","),
        totalen.vakantiegeld.toFixed(2).replace(".", ","),
        totalen.vakantieUren.toFixed(2).replace(".", ","),
        totalen.totaalBruto.toFixed(2).replace(".", ","),
      ].map(escapeCsv).join(";"));

      const csv = "﻿" + lines.join("\n"); // BOM voor Excel UTF-8
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="uren-${params.bedrijf}-${maand}.csv"`,
        },
      });
    }

    return NextResponse.json({
      bedrijf: params.bedrijf,
      maand,
      start, eind,
      regels,
      totalen: {
        uren: Math.round(totalen.uren * 100) / 100,
        diensten: totalen.diensten,
        basisLoon: Math.round(totalen.basisLoon * 100) / 100,
        vakantiegeld: Math.round(totalen.vakantiegeld * 100) / 100,
        vakantieUren: Math.round(totalen.vakantieUren * 100) / 100,
        totaalBruto: Math.round(totalen.totaalBruto * 100) / 100,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
