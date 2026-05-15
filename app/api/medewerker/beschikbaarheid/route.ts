import { NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { apiVereistGoedgekeurdeMedewerker } from "@/lib/medewerker-gate";

export const dynamic = "force-dynamic";

/** GET ?start=YYYY-MM-DD&eind=YYYY-MM-DD — eigen beschikbaarheid. */
export async function GET(req: Request) {
  const gate = await apiVereistGoedgekeurdeMedewerker();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { sessie } = gate;
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const eind  = url.searchParams.get("eind");
  if (!start || !eind) {
    return NextResponse.json({ error: "start + eind verplicht" }, { status: 400 });
  }

  const rows = await db.select()
    .from(schema.beschikbaarheid)
    .where(and(
      eq(schema.beschikbaarheid.medewerkerId, sessie.medewerkerId),
      gte(schema.beschikbaarheid.datum, start),
      lte(schema.beschikbaarheid.datum, eind),
    ));
  return NextResponse.json({
    items: rows.map((r) => ({
      datum: r.datum,
      status: r.status,
      start: r.start?.slice(0, 5) ?? null,
      eind:  r.eind?.slice(0, 5)  ?? null,
      reden: r.reden ?? "",
    })),
  });
}

/** PUT: set/update beschikbaarheid voor één dag. */
export async function PUT(req: Request) {
  const gate = await apiVereistGoedgekeurdeMedewerker();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { sessie } = gate;
  try {
    const body = (await req.json()) as {
      datum?: string;
      status?: "vrij" | "beperkt" | "niet";
      start?: string;
      eind?: string;
      reden?: string;
    };
    if (!body.datum || !body.status) {
      return NextResponse.json({ error: "datum + status verplicht" }, { status: 400 });
    }
    if (!["vrij", "beperkt", "niet"].includes(body.status)) {
      return NextResponse.json({ error: "status ongeldig" }, { status: 400 });
    }
    const startVal = body.start ? `${body.start}:00` : null;
    const eindVal  = body.eind  ? `${body.eind}:00`  : null;

    await db.insert(schema.beschikbaarheid).values({
      medewerkerId: sessie.medewerkerId,
      datum: body.datum,
      status: body.status,
      start: body.status === "beperkt" ? startVal : null,
      eind:  body.status === "beperkt" ? eindVal  : null,
      reden: body.reden ?? null,
    }).onConflictDoUpdate({
      target: [schema.beschikbaarheid.medewerkerId, schema.beschikbaarheid.datum],
      set: {
        status: body.status,
        start: body.status === "beperkt" ? startVal : null,
        eind:  body.status === "beperkt" ? eindVal  : null,
        reden: body.reden ?? null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "onbekend";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE ?datum=YYYY-MM-DD — beschikbaarheid wissen. */
export async function DELETE(req: Request) {
  const gate = await apiVereistGoedgekeurdeMedewerker();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { sessie } = gate;
  const url = new URL(req.url);
  const datum = url.searchParams.get("datum");
  if (!datum) return NextResponse.json({ error: "datum verplicht" }, { status: 400 });
  await db.delete(schema.beschikbaarheid).where(and(
    eq(schema.beschikbaarheid.medewerkerId, sessie.medewerkerId),
    eq(schema.beschikbaarheid.datum, datum),
  ));
  return NextResponse.json({ ok: true });
}
