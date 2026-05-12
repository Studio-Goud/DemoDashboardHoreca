import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { maakRegistratieToken } from "@/lib/auth";
import { verstuurUitnodiging } from "@/lib/mail";

export const dynamic = "force-dynamic";

const BEDRIJF_NAAM: Record<string, { naam: string; hex: string }> = {
  bb: { naam: "Brunch & Brew",    hex: "#0A84FF" },
  sl: { naam: "Saté Lounge",      hex: "#30B26F" },
  kl: { naam: "Het Kroket Loket", hex: "#E07A1F" },
};

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const medewerkerId = Number(params.id);
    if (!Number.isFinite(medewerkerId)) {
      return NextResponse.json({ error: "Ongeldig id" }, { status: 400 });
    }

    // Haal medewerker + eerste vestiging op
    const rows = await db.select({
      m: schema.medewerkers,
      deptSlug: schema.departments.slug,
    })
      .from(schema.medewerkers)
      .leftJoin(schema.medewerkerDepartments, eq(schema.medewerkers.id, schema.medewerkerDepartments.medewerkerId))
      .leftJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
      .where(eq(schema.medewerkers.id, medewerkerId));

    if (rows.length === 0) {
      return NextResponse.json({ error: "Medewerker niet gevonden" }, { status: 404 });
    }
    const m = rows[0].m;
    if (!m.email || m.email.startsWith("geen-email-")) {
      return NextResponse.json(
        { error: "Medewerker heeft geen geldig e-mailadres" },
        { status: 400 },
      );
    }

    const deptSlug = rows[0].deptSlug ?? "bb";
    const bedrijfInfo = BEDRIJF_NAAM[deptSlug] ?? BEDRIJF_NAAM.bb;

    console.log("[uitnodigen] medewerker gevonden", { id: m.id, email: m.email });

    // Token aanmaken (overschrijft eventueel bestaande)
    const { token, verloopt } = await maakRegistratieToken(medewerkerId);

    // Check env vars vóór de mail-call zodat we directe feedback geven
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: "RESEND_API_KEY ontbreekt in productie environment variables",
      }, { status: 500 });
    }

    // Mail versturen
    try {
      const result = await verstuurUitnodiging({
        voornaam: m.voornaam,
        email: m.email,
        token,
        bedrijfNaam: bedrijfInfo.naam,
        bedrijfHex: bedrijfInfo.hex,
        verlooptOp: verloopt,
      });
      console.log("[uitnodigen] mail verstuurd", { mailId: result.id });
      return NextResponse.json({
        ok: true,
        mailId: result.id,
        verlooptOp: verloopt.toISOString(),
      });
    } catch (mailErr) {
      const msg = mailErr instanceof Error ? mailErr.message : "Mail mislukt";
      console.error("[uitnodigen] mail-fout", msg);
      return NextResponse.json({ error: `Mail mislukt: ${msg}` }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    console.error("[uitnodigen] algemene fout", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
