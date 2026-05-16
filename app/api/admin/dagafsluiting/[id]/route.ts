/**
 * POST /api/admin/dagafsluiting/[id]
 *   body: { notitie?: string }
 *   → markeert dagafsluiting als gecontroleerd door manager/owner.
 *     Daarna kan medewerker 'm niet meer wijzigen.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { markeerAlsGecontroleerd } from "@/lib/dagafsluiting";

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
      .from(schema.dagafsluitingen)
      .innerJoin(schema.departments, eq(schema.dagafsluitingen.departmentId, schema.departments.id))
      .where(eq(schema.dagafsluitingen.id, id));
    if (!row) return NextResponse.json({ error: "niet gevonden" }, { status: 404 });
    if (row.deptSlug !== sessie.vestiging) {
      return NextResponse.json({ error: "manager mag alleen eigen vestiging" }, { status: 403 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as { notitie?: string };
  await markeerAlsGecontroleerd(id, sessie.naam, body.notitie);
  return NextResponse.json({ ok: true });
}
