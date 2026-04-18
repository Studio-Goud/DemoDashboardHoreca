import { format, parseISO, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import type { Bedrijf } from "./sumup";
import type { DagOmzet, MaandOmzet, ProductData } from "./analytics";
import {
  berekenKerncijfers,
  berekenDagOmzet,
  berekenMaandOmzet,
  berekenTopProducten,
} from "./analytics";
import { fetchAllTransactionsCached, type SumUpTransaction } from "./sumup";
import {
  fetchAllZettlePurchasesCached,
  normalizeZettleToSumUp,
} from "./zettle";
import { feestdagenVoorJaar } from "./feestdagen";
import { DRUKTE_GRENS } from "./drukte";
import { nlDagKey } from "./tz";
import { getZettleJaaroverzicht } from "./zettle-excel";
import cruises from "@/data/cruises-rotterdam.json";

const BEDRIJF_NAMEN: Record<Bedrijf, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
};

const OPENINGSTIJDEN_TEKST = `
Openingstijden:
- Maandag: 10:00-20:00
- Dinsdag: 10:00-20:00
- Woensdag: 10:00-20:00
- Donderdag: 10:00-20:00
- Vrijdag: 10:00-21:00
- Zaterdag: 10:00-20:00
- Zondag: 12:00-18:00
`.trim();

async function verzamelTransacties(bedrijf: Bedrijf): Promise<SumUpTransaction[]> {
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

  return [...zettleUniek, ...sumupTxs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function dagOmzetAlsCsv(dagen: DagOmzet[]): string {
  const rijen = ["datum,omzet,tx"];
  for (const d of dagen) {
    rijen.push(`${d.datum},${d.omzet.toFixed(2)},${d.aantalTransacties}`);
  }
  return rijen.join("\n");
}

function maandOmzetAlsCsv(maanden: MaandOmzet[]): string {
  const rijen = ["jaar,maand,omzet,tx"];
  for (const m of maanden) {
    rijen.push(
      `${m.jaar},${String(m.maand).padStart(2, "0")},${m.omzet.toFixed(2)},${m.txs}`
    );
  }
  return rijen.join("\n");
}

function feestdagenOmzetAlsCsv(dagen: DagOmzet[]): string {
  const index = new Map(dagen.map((d) => [d.datum, d]));
  const rijen = ["datum,feestdag,omzet,tx"];
  for (const jaar of [2022, 2023, 2024, 2025, 2026]) {
    for (const f of feestdagenVoorJaar(jaar)) {
      const key = nlDagKey(f.datum);
      const match = index.get(key);
      if (match) {
        rijen.push(
          `${key},${f.naam},${match.omzet.toFixed(2)},${match.aantalTransacties}`
        );
      } else {
        rijen.push(`${key},${f.naam},,`);
      }
    }
  }
  return rijen.join("\n");
}

function topBottomDagen(dagen: DagOmzet[], n = 20): string {
  const gesorteerd = [...dagen].sort((a, b) => b.omzet - a.omzet);
  const top = gesorteerd.slice(0, n);
  const bottom = gesorteerd
    .filter((d) => d.omzet > 0)
    .slice(-n);

  const formatDag = (d: DagOmzet) => {
    const datum = parseISO(d.datum);
    return `${d.datum} (${format(datum, "EEE", { locale: nl })}) · €${d.omzet.toFixed(0)} · ${d.aantalTransacties} tx`;
  };

  return [
    `Top ${n} drukste dagen ooit:`,
    ...top.map(formatDag),
    ``,
    `${n} rustigste dagen (excl. dichte dagen):`,
    ...bottom.map(formatDag),
  ].join("\n");
}

function weekdagGemiddeldeTekst(dagen: DagOmzet[]): string {
  const omzetten: number[][] = Array.from({ length: 7 }, () => []);
  const tx: number[][] = Array.from({ length: 7 }, () => []);
  const dagNamen = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

  for (const d of dagen) {
    const wd = parseISO(d.datum).getDay();
    omzetten[wd].push(d.omzet);
    tx[wd].push(d.aantalTransacties);
  }

  const rijen = ["weekdag,gem_omzet,gem_tx,metingen"];
  for (let i = 0; i < 7; i++) {
    const gem =
      omzetten[i].length > 0
        ? omzetten[i].reduce((a, b) => a + b, 0) / omzetten[i].length
        : 0;
    const gemTx =
      tx[i].length > 0 ? tx[i].reduce((a, b) => a + b, 0) / tx[i].length : 0;
    rijen.push(
      `${dagNamen[i]},${gem.toFixed(2)},${gemTx.toFixed(1)},${omzetten[i].length}`
    );
  }
  return rijen.join("\n");
}

function topProductenAlsTekst(producten: ProductData[], n = 25): string {
  const top = producten.slice(0, n);
  const rijen = ["rank,naam,omzet,aantal,gem_prijs,aandeel_%"];
  top.forEach((p, i) => {
    rijen.push(
      `${i + 1},"${p.naam}",${p.omzet.toFixed(2)},${p.aantal},${p.gemPrijs.toFixed(2)},${p.aandeel.toFixed(2)}`
    );
  });
  return rijen.join("\n");
}

interface CruiseCall {
  datum: string;
  ship: string;
  passagiers: number;
  cruiseLine: string;
  arrival?: string;
  departure?: string;
}

function cruiseAgendaAlsCsv(): string {
  const vandaag = format(new Date(), "yyyy-MM-dd");
  const grens = format(subDays(new Date(), -90), "yyyy-MM-dd");
  const volgende = (cruises as CruiseCall[])
    .filter((c) => c.datum >= vandaag && c.datum <= grens)
    .slice(0, 30);
  if (volgende.length === 0) return "";
  const rijen = ["datum,schip,pax,cruiseline,aankomst,vertrek"];
  for (const c of volgende) {
    rijen.push(
      `${c.datum},"${c.ship}",${c.passagiers},"${c.cruiseLine}",${c.arrival ?? ""},${c.departure ?? ""}`
    );
  }
  return rijen.join("\n");
}

export interface DataContext {
  bedrijf: Bedrijf;
  systemPrompt: string;
  huidigeTijd: string;
}

export async function bouwDataContext(bedrijf: Bedrijf): Promise<DataContext> {
  const alle = await verzamelTransacties(bedrijf);
  const dagOmzet = berekenDagOmzet(alle);
  const maandOmzet = berekenMaandOmzet(alle);
  const topProducten = berekenTopProducten(alle);
  const kerncijfers = berekenKerncijfers(alle);
  const jaaroverzicht = getZettleJaaroverzicht(bedrijf);

  const grens = DRUKTE_GRENS[bedrijf];
  const naam = BEDRIJF_NAMEN[bedrijf];
  const nu = new Date();
  const huidigeTijd = format(nu, "EEEE dd-MM-yyyy 'om' HH:mm", { locale: nl });

  const jaaroverzichtTekst =
    jaaroverzicht.length > 0
      ? jaaroverzicht
          .map(
            (j) =>
              `${j.jaar}: €${j.omzetInclBtw.toFixed(0)} incl BTW, ${j.aantalTransacties} tx, gem. bon €${j.gemiddeldeBon.toFixed(2)}`
          )
          .join("\n")
      : "Geen jaaroverzicht beschikbaar.";

  const cruiseTekst = cruiseAgendaAlsCsv();

  const systemPrompt = `Je bent de business-analyse assistent van ${naam} (horeca-zaak in Rotterdam Markthal). Je krijgt alle relevante omzetdata en beantwoordt vragen van de eigenaren (Ricardo of Matthieu) in helder, kort Nederlands. Altijd baseren op de data hieronder — nooit gokken. Als data ontbreekt, zeg dat dan.

ALGEMENE REGELS
- Antwoorden kort (2-5 zinnen). Geen preambule ("Goede vraag!"), direct to the point.
- Bedragen in euro's, Nederlandse notatie (€ 1.234,56 of €1.234). Datums dd-MM-yyyy.
- Bij vergelijkingen altijd expliciet welke periodes je vergelijkt.
- Je mag rekenen en aggregeren op de onderstaande data. Als iets niet in de data staat, antwoord eerlijk "dat staat niet in de data".

CONTEXT
Bedrijf: ${naam} (code: ${bedrijf})
Huidige tijd: ${huidigeTijd}

${OPENINGSTIJDEN_TEKST}

DRUKTE-DREMPELS (incl. BTW):
- Normaal vanaf €${grens.normaal}
- Druk vanaf €${grens.druk}
- Zeer druk vanaf €${grens.zeerDruk}

JAAROVERZICHT (uit Zettle-rapporten):
${jaaroverzichtTekst}

KERNCIJFERS NU:
- Vandaag: €${kerncijfers.vandaag.omzet.toFixed(2)} (${kerncijfers.vandaag.txs} tx)
- Gisteren t/m zelfde tijd: €${kerncijfers.gisteren.omzet.toFixed(2)}
- Deze week: €${kerncijfers.dezeWeek.omzet.toFixed(2)}
- Vorige week: €${kerncijfers.vorigeWeek.omzet.toFixed(2)}
- Deze maand: €${kerncijfers.dezeMaand.omzet.toFixed(2)}
- ${nu.getFullYear()} YTD: €${kerncijfers.ditJaar.omzet.toFixed(2)}
- ${nu.getFullYear() - 1} YTD: €${kerncijfers.vorigJaarTotNu.omzet.toFixed(2)}
- Verwacht vandaag: €${kerncijfers.verwachtVandaag.toFixed(2)}
- Drukste dag ooit: ${kerncijfers.druksteDag ? `€${kerncijfers.druksteDag.omzet.toFixed(2)} op ${kerncijfers.druksteDag.datum}` : "—"}
- Gem. omzet per dag: €${kerncijfers.gemOmzetPerDag.toFixed(2)}

DAGOMZET (CSV — ${dagOmzet.length} dagen, datum,omzet,tx):
${dagOmzetAlsCsv(dagOmzet)}

MAANDOMZET (CSV):
${maandOmzetAlsCsv(maandOmzet)}

FEESTDAGEN-OMZET (CSV — koppelt NL-feestdagen aan dagomzet):
${feestdagenOmzetAlsCsv(dagOmzet)}

GEM. OMZET PER WEEKDAG (CSV):
${weekdagGemiddeldeTekst(dagOmzet)}

TOP/BOTTOM DAGEN:
${topBottomDagen(dagOmzet, 20)}

TOP 25 PRODUCTEN (CSV):
${topProductenAlsTekst(topProducten, 25)}

${cruiseTekst ? `KOMENDE CRUISES ROTTERDAM (CSV — relevant voor drukte):\n${cruiseTekst}` : ""}
`;

  return {
    bedrijf,
    systemPrompt,
    huidigeTijd,
  };
}
