import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { publiceerWeek } from "@/lib/rooster";
import type { Bedrijf } from "@/lib/sumup";
import { notify, heeftNotifyConfig } from "@/lib/notify";

const BEDRIJF_NAAM: Record<Bedrijf, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

export const dynamic = "force-dynamic";

const VALID: Bedrijf[] = ["bb", "sl", "kl"];
function isBedrijf(s: unknown): s is Bedrijf {
  return typeof s === "string" && (VALID as string[]).includes(s);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      bedrijf?: string;
      start?: string;     // YYYY-MM-DD
      eind?: string;      // YYYY-MM-DD
    };
    if (!isBedrijf(body.bedrijf))
      return NextResponse.json({ error: "bedrijf verplicht" }, { status: 400 });
    if (!body.start || !body.eind)
      return NextResponse.json({ error: "start en eind verplicht" }, { status: 400 });

    const aantal = await publiceerWeek(body.bedrijf as Bedrijf, body.start, body.eind);
    revalidateTag("shiftbase");

    // Push-alert: laat alle ingelogde gebruikers weten dat het rooster
    // gepubliceerd is — vooral nuttig voor medewerkers die wachten op hun
    // shifts. Niet-blokkerend; faalt stil.
    const notifyCfg = heeftNotifyConfig();
    if (aantal > 0 && (notifyCfg.webpush || notifyCfg.telegram || notifyCfg.email)) {
      const bedrijfNaam = BEDRIJF_NAAM[body.bedrijf as Bedrijf];
      const periode = `${body.start.slice(8, 10)}/${body.start.slice(5, 7)} – ${body.eind.slice(8, 10)}/${body.eind.slice(5, 7)}`;
      notify({
        onderwerp: `📅 Rooster gepubliceerd · ${bedrijfNaam}`,
        tekstPlatte: `Week ${periode} staat klaar (${aantal} ${aantal === 1 ? "dienst" : "diensten"}). Check je shifts in de app.`,
        url: `/${body.bedrijf}/rooster`,
        tag: `rooster-publish-${body.bedrijf}-${body.start}`,
      }).catch(() => null);
    }

    return NextResponse.json({ gepubliceerd: aantal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
