import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { huidigeSessie } from "@/lib/auth";
import { logAudit, snapshotKlokEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET: laatste klok-event + open shift voor de medewerker. */
export async function GET() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }

  const rows = await db.select()
    .from(schema.klokEvents)
    .where(eq(schema.klokEvents.medewerkerId, sessie.medewerkerId))
    .orderBy(desc(schema.klokEvents.tijdstempel))
    .limit(20);

  const laatste = rows[0] ?? null;
  const ingeklokt = laatste?.type === "in";

  return NextResponse.json({
    ingeklokt,
    laatste: laatste ? {
      type: laatste.type,
      tijdstempel: laatste.tijdstempel,
    } : null,
    historie: rows.map((r) => ({
      id: r.id,
      type: r.type,
      tijdstempel: r.tijdstempel,
      handmatig: r.handmatig,
    })),
  });
}

/** POST: registreer een nieuw klok-event (in/uit). */
export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      type?: string;
      latitude?: number;
      longitude?: number;
    };
    if (body.type !== "in" && body.type !== "out") {
      return NextResponse.json({ error: "type moet 'in' of 'out' zijn" }, { status: 400 });
    }

    // Voorkom dubbele klok-events achter elkaar
    const laatste = await db.select()
      .from(schema.klokEvents)
      .where(eq(schema.klokEvents.medewerkerId, sessie.medewerkerId))
      .orderBy(desc(schema.klokEvents.tijdstempel))
      .limit(1);
    if (laatste.length > 0 && laatste[0].type === body.type) {
      return NextResponse.json({
        error: body.type === "in" ? "Je bent al ingeklokt" : "Je bent al uitgeklokt",
      }, { status: 409 });
    }

    // Probeer huidige roster te vinden (zodat klok aan dienst gekoppeld is)
    const vandaag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
    const huidigeRoster = await db.select()
      .from(schema.rosters)
      .where(and(
        eq(schema.rosters.medewerkerId, sessie.medewerkerId),
        eq(schema.rosters.datum, vandaag),
      ))
      .limit(1);

    const ingevoegd = await db.insert(schema.klokEvents).values({
      medewerkerId: sessie.medewerkerId,
      rosterId: huidigeRoster[0]?.id ?? null,
      type: body.type,
      tijdstempel: new Date(),
      latitude:  body.latitude !== undefined  ? String(body.latitude)  : null,
      longitude: body.longitude !== undefined ? String(body.longitude) : null,
      handmatig: false,
    }).returning();

    // Audit-log: elke klok-actie is een onomkeerbare gewerkte-uren-melding.
    // We loggen wie het deed via de sessie zodat we altijd weten welke
    // medewerker zelf heeft geklokt vs handmatige correctie door manager.
    await logAudit(
      "klok_event",
      ingevoegd[0].id,
      "create",
      null,
      snapshotKlokEvent(ingevoegd[0]),
      {
        doorMedewerkerId: sessie.medewerkerId,
        doorRol: sessie.rol,
        ipAdres: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    );

    return NextResponse.json({
      ok: true,
      id: ingevoegd[0].id,
      tijdstempel: ingevoegd[0].tijdstempel,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
