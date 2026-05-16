/**
 * POST /api/admin/ruilverzoek/[id]
 *   body: { actie: "goedkeuren" | "weigeren", notitie? }
 *
 * Owner/manager beoordeelt een gereserveerd ruilverzoek. Manager mag alleen
 * verzoeken in z'n eigen vestiging beoordelen.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { keurRuilverzoekGoed, weigerRuilverzoek } from "@/lib/ruilverzoeken";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ongeldige id" }, { status: 400 });
  }

  // Vestiging-check voor manager
  if (sessie.rol === "manager" && sessie.vestiging) {
    const [row] = await db
      .select({ deptSlug: schema.departments.slug })
      .from(schema.ruilverzoeken)
      .innerJoin(schema.rosters, eq(schema.ruilverzoeken.rosterId, schema.rosters.id))
      .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
      .where(eq(schema.ruilverzoeken.id, id));
    if (!row) return NextResponse.json({ error: "verzoek niet gevonden" }, { status: 404 });
    if (row.deptSlug !== sessie.vestiging) {
      return NextResponse.json(
        { error: "manager mag alleen eigen vestiging beoordelen" },
        { status: 403 },
      );
    }
  }

  const body = (await req.json().catch(() => ({}))) as { actie?: string; notitie?: string };
  try {
    if (body.actie === "goedkeuren") {
      await keurRuilverzoekGoed({
        ruilverzoekId: id,
        managerNaam: sessie.naam,
        managerRol: sessie.rol,
        notitie: body.notitie?.trim() || undefined,
      });
    } else if (body.actie === "weigeren") {
      await weigerRuilverzoek({
        ruilverzoekId: id,
        managerNaam: sessie.naam,
        managerRol: sessie.rol,
        notitie: body.notitie?.trim() || undefined,
      });
    } else {
      return NextResponse.json({ error: "actie moet 'goedkeuren' of 'weigeren' zijn" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fout" }, { status: 400 });
  }
}
