import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { haalIngKwartaal, haalFacturenOp, haalContantOp } from "@/lib/boekhouding-kv";
import { berekenKwartaal, euro } from "@/lib/boekhouding";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);
const MAANDEN = ["", "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December"];

function checkBedrijf(b: string): BedrijfSlug | null {
  return GELDIGE_BEDRIJVEN.has(b as BedrijfSlug) ? (b as BedrijfSlug) : null;
}

// GET /api/administratie/kwartaal/[bedrijf]?jaar=2026&kwartaal=1&format=json|xlsx
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());
  const kwartaal = (Number(searchParams.get("kwartaal") ?? 1)) as 1 | 2 | 3 | 4;
  const format = searchParams.get("format") ?? "json";

  const [ingTxs, facturen, contant] = await Promise.all([
    haalIngKwartaal(bedrijf, jaar, kwartaal),
    haalFacturenOp(bedrijf, jaar),
    haalContantOp(bedrijf, jaar),
  ]);

  const rapport = berekenKwartaal(jaar, kwartaal, bedrijf, ingTxs, facturen, contant);

  if (format !== "xlsx") {
    return NextResponse.json(rapport);
  }

  // Excel export
  const wb = new ExcelJS.Workbook();
  wb.creator = "Omzetoverzicht";
  wb.created = new Date();

  // === Sheet 1: Samenvatting ===
  const samen = wb.addWorksheet("Samenvatting");
  const BEDRIJF_NAAM: Record<BedrijfSlug, string> = { bb: "Brunch & Brew", sl: "Saté Lounge", kl: "Het Kroket Loket" };

  samen.columns = [{ width: 35 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];

  const titleRow = samen.addRow([`${BEDRIJF_NAAM[bedrijf]} — Q${kwartaal} ${jaar}`]);
  titleRow.font = { bold: true, size: 14 };
  samen.addRow([]);

  // Headers
  const headerRow = samen.addRow(["", ...rapport.maanden.map((m) => MAANDEN[m.maand]), "Totaal"]);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  const secties = [
    { label: "OMZET", isHeader: true },
    { label: "Omzet (bruto incl. BTW)", field: "omzetBruto" },
    { label: "BTW op omzet (9%)", field: "omzetBtwBetaald" },
    { label: "" },
    { label: "KOSTEN", isHeader: true },
    { label: "Kosten totaal (incl. BTW)", field: "kostenTotaal" },
    { label: "Voorbelasting 21%", field: "voorbelasting21" },
    { label: "Voorbelasting 9%", field: "voorbelasting9" },
    { label: "Salarissen", field: "salarissen" },
    { label: "Contant inkomsten", field: "contantInkomsten" },
    { label: "Contant uitgaven", field: "contantUitgaven" },
    { label: "" },
    { label: "BTW AANGIFTE", isHeader: true },
    { label: "BTW te voldoen (+) / terug (-)", field: "btwTeVoldoen" },
    { label: "" },
    { label: "RESULTAAT", isHeader: true },
    { label: "Bruto resultaat", field: "brutoResultaat" },
    { label: "Netto resultaat", field: "nettoResultaat" },
  ] as Array<{ label: string; field?: string; isHeader?: boolean }>;

  for (const sectie of secties) {
    if (sectie.label === "") {
      samen.addRow([]);
      continue;
    }

    if (sectie.isHeader) {
      const row = samen.addRow([sectie.label, ...rapport.maanden.map(() => ""), ""]);
      row.font = { bold: true, size: 11 };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
      continue;
    }

    const field = sectie.field as keyof typeof rapport.maanden[0];
    const waarden = rapport.maanden.map((m) => m[field] as number ?? 0);
    const totaalWaarde = rapport.totaal[field as keyof typeof rapport.totaal] as number ?? waarden.reduce((s, v) => s + v, 0);
    const row = samen.addRow([sectie.label, ...waarden, totaalWaarde]);

    // Opmaak getallen
    for (let c = 2; c <= rapport.maanden.length + 2; c++) {
      const cell = row.getCell(c);
      cell.numFmt = '€#,##0.00';
      const val = cell.value as number;
      if (sectie.field === "nettoResultaat" || sectie.field === "btwTeVoldoen") {
        cell.font = { bold: true, color: { argb: val >= 0 ? "FF00A650" : "FFCC0000" } };
      }
    }
  }

  // === Sheet 2: ING Transacties ===
  const ingSheet = wb.addWorksheet("ING Transacties");
  ingSheet.columns = [
    { header: "Datum", key: "datum", width: 12 },
    { header: "Omschrijving", key: "omschrijving", width: 40 },
    { header: "Richting", key: "richting", width: 10 },
    { header: "Bedrag", key: "bedrag", width: 14 },
    { header: "BTW 21%", key: "btw21", width: 12 },
    { header: "BTW 9%", key: "btw9", width: 12 },
    { header: "Categorie", key: "categorie", width: 18 },
    { header: "BTW status", key: "btwStatus", width: 12 },
    { header: "Mutatiesoort", key: "mutatiesoort", width: 20 },
  ];

  ingSheet.getRow(1).font = { bold: true };
  ingSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ingSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const tx of rapport.ingTransacties) {
    const row = ingSheet.addRow(tx);
    if (tx.btwStatus === "review") {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
    }
    row.getCell("bedrag").numFmt = '€#,##0.00';
    row.getCell("btw21").numFmt = '€#,##0.00';
    row.getCell("btw9").numFmt = '€#,##0.00';
  }

  // === Sheet 3: Facturen ===
  const factSheet = wb.addWorksheet("Facturen");
  factSheet.columns = [
    { header: "Datum", key: "datum", width: 12 },
    { header: "Leverancier", key: "leverancier", width: 30 },
    { header: "Factuurnummer", key: "factuurnummer", width: 20 },
    { header: "Incl. BTW", key: "bedragInclBtw", width: 14 },
    { header: "BTW 21%", key: "btw21", width: 12 },
    { header: "BTW 9%", key: "btw9", width: 12 },
    { header: "BTW tarief", key: "btwTarief", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Bestand", key: "bestandsnaam", width: 30 },
  ];

  factSheet.getRow(1).font = { bold: true };
  factSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  factSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const f of rapport.facturen) {
    const row = factSheet.addRow(f);
    row.getCell("bedragInclBtw").numFmt = '€#,##0.00';
    row.getCell("btw21").numFmt = '€#,##0.00';
    row.getCell("btw9").numFmt = '€#,##0.00';
  }

  // === Sheet 4: Contant ===
  const contantSheet = wb.addWorksheet("Contant");
  contantSheet.columns = [
    { header: "Datum", key: "datum", width: 12 },
    { header: "Omschrijving", key: "omschrijving", width: 30 },
    { header: "Type", key: "type", width: 12 },
    { header: "Bedrag", key: "bedrag", width: 14 },
    { header: "BTW 21%", key: "btw21", width: 12 },
    { header: "BTW 9%", key: "btw9", width: 12 },
  ];

  contantSheet.getRow(1).font = { bold: true };
  contantSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  contantSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const c of rapport.contant) {
    const row = contantSheet.addRow(c);
    row.getCell("bedrag").numFmt = '€#,##0.00';
    row.getCell("btw21").numFmt = '€#,##0.00';
    row.getCell("btw9").numFmt = '€#,##0.00';
  }

  const xlsxBuffer = await wb.xlsx.writeBuffer();
  const bestandsnaam = `${bedrijf.toUpperCase()}_Q${kwartaal}_${jaar}_administratie.xlsx`;

  return new NextResponse(xlsxBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
    },
  });
}
