import { NextRequest, NextResponse } from "next/server";
import { parseIngExcel, parseIngCsv, herclassificeer, ingParseWaarschuwingen } from "@/lib/ing";
import { slaIngOp, haalIngOp, updateIngTransactie, verwijderIngMaand } from "@/lib/boekhouding-kv";
import { extracteerPatroon, slaRegelOp, geleerdeRegels, matchRegel, teltToepassing } from "@/lib/ing-leer-regels";

type BedrijfSlug = "bb" | "sl" | "kl";
const GELDIGE_BEDRIJVEN = new Set<BedrijfSlug>(["bb", "sl", "kl"]);

function checkBedrijf(b: string): BedrijfSlug | null {
  return GELDIGE_BEDRIJVEN.has(b as BedrijfSlug) ? (b as BedrijfSlug) : null;
}

const CATEGORIE_TARIEF: Record<string, 0 | 9 | 21> = {
  levensmiddelen: 9,
  huur: 21, telecom: 21, software: 21, marketing: 21, materiaal: 21, representatie: 21,
  salaris: 0, belasting: 0, pensioen: 0, "sociale-lasten": 0, bankkosten: 0,
  verzekering: 0, vergoeding: 0, omzet: 0, overig: 0,
  kasstorting: 0, "interne-overboeking": 0, terugbetaling: 0,
  "dga-er": 21, "dga-mp5": 0,
};

function berekenBtwUitTarief(bedrag: number, tarief: 0 | 9 | 21): { btw21: number; btw9: number } {
  const rnd = (n: number) => Math.round(n * 100) / 100;
  if (tarief === 21) return { btw21: rnd(bedrag - bedrag / 1.21), btw9: 0 };
  if (tarief === 9)  return { btw21: 0, btw9: rnd(bedrag - bedrag / 1.09) };
  return { btw21: 0, btw9: 0 };
}

// POST /api/administratie/ing/[bedrijf] — upload ING Excel of CSV
export async function POST(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const formData = await req.formData();
  const bestand = formData.get("bestand") as File | null;
  if (!bestand) return NextResponse.json({ error: "Geen bestand" }, { status: 400 });

  const buffer = Buffer.from(await bestand.arrayBuffer());
  const naam = bestand.name.toLowerCase();

  let txs;
  if (naam.endsWith(".xlsx") || naam.endsWith(".xls")) {
    txs = parseIngExcel(buffer);
  } else if (naam.endsWith(".csv") || naam.endsWith(".txt")) {
    txs = parseIngCsv(buffer.toString("utf-8"));
  } else {
    return NextResponse.json({ error: "Gebruik .xlsx, .xls of .csv" }, { status: 400 });
  }

  if (txs.length === 0) {
    return NextResponse.json({ error: "Geen transacties gevonden in bestand" }, { status: 422 });
  }

  // Pas geleerde regels toe op transacties die nog review zijn — voorkomt
  // dat de eigenaar zelfde leveranciers iedere maand opnieuw moet
  // categoriseren.
  const regels = await geleerdeRegels(bedrijf);
  if (regels.length > 0) {
    for (const tx of txs) {
      if (tx.btwStatus !== "review") continue;
      const match = matchRegel(regels, tx.omschrijving);
      if (!match) continue;
      const { btw21, btw9 } = berekenBtwUitTarief(tx.bedrag, match.tarief);
      tx.btw21 = btw21;
      tx.btw9 = btw9;
      tx.categorie = match.categorie;
      tx.btwStatus = "auto";
      // niet-blokkerend tellen
      teltToepassing(bedrijf, match.patroon).catch(() => null);
    }
  }

  await slaIngOp(bedrijf, txs);

  const reviewCount = txs.filter((t) => t.btwStatus === "review").length;
  const waarschuwingen = ingParseWaarschuwingen();
  return NextResponse.json({
    opgeslagen: txs.length,
    reviewNodig: reviewCount,
    waarschuwingen,
    bericht: `${txs.length} transacties verwerkt, ${reviewCount} vereisen handmatige BTW-controle.${waarschuwingen.length > 0 ? ` ${waarschuwingen.length} parser-waarschuwing(en).` : ""}`,
  });
}

// GET /api/administratie/ing/[bedrijf]?jaar=2026&maand=1
export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());
  const maandParam = searchParams.get("maand");
  const maanden = maandParam ? [Number(maandParam)] : undefined;

  const txs = await haalIngOp(bedrijf, jaar, maanden);
  return NextResponse.json({ transacties: txs, totaal: txs.length });
}

// PUT /api/administratie/ing/[bedrijf] — herclassificeer alle review-transacties met huidige regels
export async function PUT(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar") ?? new Date().getFullYear());

  const force = searchParams.get("force") === "true";
  const txs = await haalIngOp(bedrijf, jaar);
  const bijgewerkt = herclassificeer(txs, force);
  const veranderd = bijgewerkt.filter((t, i) => t.btwStatus !== txs[i].btwStatus || t.categorie !== txs[i].categorie);

  await slaIngOp(bedrijf, bijgewerkt);

  return NextResponse.json({
    verwerkt: txs.length,
    bijgewerkt: veranderd.length,
    reviewOver: bijgewerkt.filter((t) => t.btwStatus === "review").length,
  });
}

// DELETE /api/administratie/ing/[bedrijf]?jaar=2026&maand=4 — wis alle ING data voor een maand
export async function DELETE(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const jaar = Number(searchParams.get("jaar"));
  const maand = Number(searchParams.get("maand"));
  if (!jaar || !maand) return NextResponse.json({ error: "jaar en maand verplicht" }, { status: 400 });

  await verwijderIngMaand(bedrijf, jaar, maand);
  return NextResponse.json({ ok: true, bericht: `ING data voor ${jaar}-${String(maand).padStart(2, "0")} verwijderd.` });
}

// PATCH /api/administratie/ing/[bedrijf] — handmatig BTW corrigeren
// Side-effect: leert een regel zodat dezelfde leverancier volgende keer
// automatisch wordt herkend (mits er een herkenbaar patroon te extraheren is).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = checkBedrijf(params.bedrijf);
  if (!bedrijf) return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });

  const body = await req.json() as {
    id: string; jaar: number; maand: number;
    btw21?: number; btw9?: number; categorie?: string;
    /** Optioneel: omschrijving voor regel-extractie (anders skip leren) */
    omschrijving?: string;
    /** Optioneel: splits. Totaal bedrag wordt afgedwongen door UI. */
    splits?: Array<{ bedrag: number; categorie: string; tarief: 0 | 9 | 21; notitie?: string }>;
  };

  // Splits-pad: bereken BTW per deel, sla op zonder enkele categorie.
  if (body.splits && body.splits.length > 0) {
    const rnd2 = (n: number) => Math.round(n * 100) / 100;
    const splits = body.splits
      .filter((s) => s.bedrag > 0 && s.categorie)
      .map((s) => {
        const { btw21, btw9 } = berekenBtwUitTarief(s.bedrag, s.tarief);
        return {
          bedrag: rnd2(s.bedrag),
          btw21, btw9,
          categorie: s.categorie,
          notitie: s.notitie?.slice(0, 200),
        };
      });
    if (splits.length === 0) {
      return NextResponse.json({ error: "Splits leeg of ongeldig" }, { status: 400 });
    }
    await updateIngTransactie(bedrijf, body.jaar, body.maand, body.id, {
      splits,
      btwStatus: "handmatig",
    });
    return NextResponse.json({ ok: true, splits: splits.length });
  }

  await updateIngTransactie(bedrijf, body.jaar, body.maand, body.id, {
    btw21: body.btw21,
    btw9: body.btw9,
    categorie: body.categorie,
    btwStatus: "handmatig",
  });

  // Leer-laag: alleen als categorie meegegeven is en we een patroon kunnen
  // extraheren. Faalt niet-blokkerend; KV-fout mag opslaan niet tegenhouden.
  if (body.categorie && body.omschrijving) {
    try {
      const patroon = extracteerPatroon(body.omschrijving);
      const tarief = CATEGORIE_TARIEF[body.categorie];
      if (patroon && tarief !== undefined) {
        await slaRegelOp(bedrijf, patroon, body.categorie, tarief, "manueel", 1.0);
      }
    } catch {
      // niet kritiek
    }
  }

  return NextResponse.json({ ok: true });
}
