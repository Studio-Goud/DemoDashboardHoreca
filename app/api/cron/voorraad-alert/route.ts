/**
 * Vercel Cron — dagelijks 09:00 NL. Scan per bedrijf alle producten en
 * push notificatie als één of meer KRITIEK staan (≤ drempelKritiek).
 * Voorkomt dat een vestiging zonder espresso-bonen open gaat zonder dat
 * iemand het op tijd doorhad.
 */
import { NextResponse } from "next/server";
import { listProducten } from "@/lib/voorraad";
import { notify, heeftNotifyConfig } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Slug = "bb" | "sl" | "kl";
const BEDRIJVEN: Array<{ slug: Slug; naam: string; emoji: string }> = [
  { slug: "bb", naam: "Brunch & Brew",    emoji: "☕" },
  { slug: "sl", naam: "Saté Lounge",      emoji: "🍢" },
  { slug: "kl", naam: "Het Kroket Loket", emoji: "🥟" },
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const verwacht = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (verwacht && auth !== verwacht) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = heeftNotifyConfig();
  if (!cfg.webpush && !cfg.telegram && !cfg.email) {
    return NextResponse.json({ status: "skipped", reden: "Geen notify-config" });
  }

  const resultaten: Array<{ bedrijf: Slug; kritiek: number; verzonden: boolean }> = [];

  for (const b of BEDRIJVEN) {
    const producten = await listProducten(b.slug).catch(() => []);
    const kritiek = producten.filter((p) => p.niveau === "kritiek" || p.niveau === "op");
    if (kritiek.length === 0) {
      resultaten.push({ bedrijf: b.slug, kritiek: 0, verzonden: false });
      continue;
    }
    const top3 = kritiek.slice(0, 3).map((p) => `${p.naam} (${p.aantal})`).join(", ");
    const extra = kritiek.length > 3 ? ` +${kritiek.length - 3} andere` : "";
    await notify({
      onderwerp: `${b.emoji} ${b.naam}: voorraad kritiek`,
      tekstPlatte: `${kritiek.length} ${kritiek.length === 1 ? "product" : "producten"} onder de drempel. ${top3}${extra}.`,
      url: `/${b.slug}/voorraad`,
      tag: `voorraad-kritiek-${b.slug}`,
    });
    resultaten.push({ bedrijf: b.slug, kritiek: kritiek.length, verzonden: true });
  }

  return NextResponse.json({ ok: true, resultaten, gegenereerd: new Date().toISOString() });
}
