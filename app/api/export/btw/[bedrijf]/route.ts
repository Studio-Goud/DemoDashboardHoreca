import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { fetchAllTransactionsCached, type Bedrijf } from "@/lib/sumup";
import {
  fetchAllZettlePurchasesCached,
  normalizeZettleToSumUp,
} from "@/lib/zettle";
import { nlDagKey, nlDate } from "@/lib/tz";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BEDRIJF_NAAM: Record<Bedrijf, string> = {
  bb: "Brunch_en_Brew",
  sl: "Sate_Lounge",
  kl: "Kroket_Loket",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { bedrijf: string } }
) {
  const bedrijf = params.bedrijf as Bedrijf;
  if (!["bb", "sl", "kl"].includes(bedrijf)) {
    return NextResponse.json({ error: "Onbekend bedrijf" }, { status: 400 });
  }

  const url = new URL(req.url);
  const jaar = Number(url.searchParams.get("jaar")) || new Date().getFullYear();
  const maand = Number(url.searchParams.get("maand")); // 1-12, optioneel

  const [sumupResult, zettleResult] = await Promise.allSettled([
    fetchAllTransactionsCached(bedrijf),
    fetchAllZettlePurchasesCached(bedrijf),
  ]);

  const sumupTxs =
    sumupResult.status === "fulfilled" ? sumupResult.value : [];
  const zettleTxs =
    zettleResult.status === "fulfilled"
      ? normalizeZettleToSumUp(zettleResult.value)
      : [];

  const sumupSleutels = new Set(
    sumupTxs.map((tx) => `${tx.timestamp.slice(0, 19)}|${tx.amount.toFixed(2)}`)
  );
  const zettleUniek = zettleTxs.filter(
    (tx) =>
      !sumupSleutels.has(`${tx.timestamp.slice(0, 19)}|${tx.amount.toFixed(2)}`)
  );
  const alle = [...zettleUniek, ...sumupTxs];

  // Filter op jaar/maand
  const gefilterd = alle.filter((tx) => {
    const d = nlDate(tx.timestamp);
    if (d.getFullYear() !== jaar) return false;
    if (maand && d.getMonth() + 1 !== maand) return false;
    return true;
  });

  // Per-dag samenvatting
  const perDag = new Map<string, { omzetIncl: number; txs: number }>();
  for (const tx of gefilterd) {
    const dag = nlDagKey(tx.timestamp);
    const cur = perDag.get(dag) ?? { omzetIncl: 0, txs: 0 };
    cur.omzetIncl += tx.amount;
    cur.txs += 1;
    perDag.set(dag, cur);
  }

  // Aanname: NL-horeca tarief 9% (eten + niet-alcoholische drank)
  // Voor een nauwkeurigere splitsing zou je productcategorieën moeten mappen
  // naar 9% vs 21% — dat vergt handmatige productclassificatie.
  const BTW_PERCENTAGE = 0.09;

  const rijen: Array<Record<string, string | number>> = [];
  for (const [datum, v] of Array.from(perDag.entries()).sort()) {
    const omzetExcl = v.omzetIncl / (1 + BTW_PERCENTAGE);
    const btw = v.omzetIncl - omzetExcl;
    rijen.push({
      Datum: datum,
      Dag: format(parseISO(datum), "EEEE", { locale: nl }),
      Transacties: v.txs,
      "Omzet excl BTW": Number(omzetExcl.toFixed(2)),
      "BTW 9%": Number(btw.toFixed(2)),
      "Omzet incl BTW": Number(v.omzetIncl.toFixed(2)),
    });
  }

  const totaalIncl = gefilterd.reduce((s, tx) => s + tx.amount, 0);
  const totaalExcl = totaalIncl / (1 + BTW_PERCENTAGE);
  const totaalBtw = totaalIncl - totaalExcl;
  rijen.push({
    Datum: "TOTAAL",
    Dag: "",
    Transacties: gefilterd.length,
    "Omzet excl BTW": Number(totaalExcl.toFixed(2)),
    "BTW 9%": Number(totaalBtw.toFixed(2)),
    "Omzet incl BTW": Number(totaalIncl.toFixed(2)),
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rijen);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    maand ? `${jaar}-${String(maand).padStart(2, "0")}` : String(jaar)
  );

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const bestandsnaam = `BTW_${BEDRIJF_NAAM[bedrijf]}_${jaar}${maand ? "-" + String(maand).padStart(2, "0") : ""}.xlsx`;

  // Convert Buffer to Uint8Array for Next.js Response body
  const bytes = new Uint8Array(buf);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
    },
  });
}
