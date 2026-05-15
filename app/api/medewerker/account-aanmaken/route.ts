/**
 * POST /api/medewerker/account-aanmaken
 *   body: { email, wachtwoord, voornaam, achternaam }
 *   → { ok: true, medewerkerId, naam } + sessie-cookie
 *
 * Zelf-registratie zonder uitnodiging. Account direct actief en ingelogd.
 * Owner reviewt achteraf in de admin-tab. PIN kiezen + NAW invullen kan
 * daarna in het portaal (/m/pin-instellen + /m/profiel).
 *
 * Aparte route van /api/medewerker/registreren omdat die laatste de oude
 * uitgenodigde-medewerker flow gebruikt (token + 6-cijferige code).
 */
import { NextResponse } from "next/server";
import { registreerMedewerker } from "@/lib/auth";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 0007 voegt wachtwoord_hash + NAW kolommen toe — eerste account-aanmaken
  // mag niet hangen op een ontbrekende kolom.
  await runAllePendingMigraties().catch(() => null);

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    wachtwoord?: string;
    voornaam?: string;
    achternaam?: string;
  };

  if (!body.email || !body.wachtwoord || !body.voornaam || !body.achternaam) {
    return NextResponse.json({ error: "email, wachtwoord, voornaam en achternaam zijn verplicht" }, { status: 400 });
  }

  const resultaat = await registreerMedewerker({
    email: body.email,
    wachtwoord: body.wachtwoord,
    voornaam: body.voornaam,
    achternaam: body.achternaam,
  });

  if ("fout" in resultaat) {
    return NextResponse.json({ error: resultaat.fout }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    medewerkerId: resultaat.medewerkerId,
    naam: resultaat.naam,
  });
}
