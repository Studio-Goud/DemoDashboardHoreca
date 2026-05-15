/**
 * Publieke endpoint voor klant-feedback. Wordt aangeroepen vanaf
 * /feedback/[bedrijf]?d=YYYY-MM-DD na het QR-scannen aan tafel/op de bon.
 *
 * Rate-limit: 5 reviews per IP per 15 minuten — voldoende voor een tafel
 * met 4 vrienden, niet genoeg voor spam-bombing.
 */
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db/client";
import { feedbackReviews, departments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ipUitRequest, registreerPoging } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_SLUGS = new Set(["bb", "sl", "kl"]);

export async function POST(req: Request) {
  const ip = ipUitRequest(req);
  const limiet = await registreerPoging(`feedback:${ip}`, 5, 15 * 60);
  if (limiet.geblokkeerd) {
    return NextResponse.json({ error: "Te veel reviews vanaf dit netwerk. Probeer over een paar minuten opnieuw." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    bedrijf?: string;
    datum?: string;
    sterren?: number;
    tekst?: string;
  };

  if (!body.bedrijf || !ALLOWED_SLUGS.has(body.bedrijf)) {
    return NextResponse.json({ error: "Ongeldig bedrijf" }, { status: 400 });
  }
  if (!body.datum || !/^\d{4}-\d{2}-\d{2}$/.test(body.datum)) {
    return NextResponse.json({ error: "Ongeldige datum" }, { status: 400 });
  }
  // Plausibele datum-check: max 2 dagen terug, niet in de toekomst — klant
  // scant aan tafel, niet weken later.
  const datum = new Date(body.datum + "T00:00:00");
  const nu = new Date();
  const tweeDagenGeleden = new Date(nu.getTime() - 2 * 86400000);
  const morgenStart = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1);
  if (datum < tweeDagenGeleden || datum >= morgenStart) {
    return NextResponse.json({ error: "QR-code is verlopen" }, { status: 400 });
  }
  if (!Number.isInteger(body.sterren) || body.sterren! < 1 || body.sterren! > 5) {
    return NextResponse.json({ error: "Sterren moet 1-5 zijn" }, { status: 400 });
  }
  const tekst = (body.tekst ?? "").trim().slice(0, 500) || null;

  // Verifieer dat bedrijf bestaat (defense-in-depth)
  const dept = await db.select({ id: departments.id }).from(departments).where(eq(departments.slug, body.bedrijf)).limit(1);
  if (dept.length === 0) {
    return NextResponse.json({ error: "Bedrijf bestaat niet" }, { status: 404 });
  }

  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);

  await db.insert(feedbackReviews).values({
    bedrijfSlug: body.bedrijf,
    datum: body.datum,
    sterren: body.sterren!,
    tekst,
    ipHash,
  });

  return NextResponse.json({ ok: true });
}
