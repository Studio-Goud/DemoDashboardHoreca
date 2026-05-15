/**
 * POST /api/admin/medewerker-goedkeuren
 *   body: { medewerkerId: number, goedgekeurd: boolean }
 *   → { ok: true }
 *
 * Owner of manager kan een medewerker goedkeuren (of intrekken). Pas
 * daarna mag de medewerker rooster/uren/beschikbaarheid zien — daarvoor
 * staat 'ie op /m/wachten.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { runAllePendingMigraties } from "@/lib/db/init-sql";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await runAllePendingMigraties().catch(() => null);

  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    medewerkerId?: number;
    goedgekeurd?: boolean;
  };
  if (!body.medewerkerId || typeof body.goedgekeurd !== "boolean") {
    return NextResponse.json({ error: "medewerkerId en goedgekeurd verplicht" }, { status: 400 });
  }

  await db.update(schema.medewerkers).set({
    goedgekeurd: body.goedgekeurd,
    goedgekeurdOp: body.goedgekeurd ? new Date() : null,
    goedgekeurdDoor: body.goedgekeurd ? sessie.naam : null,
    updatedAt: new Date(),
  }).where(eq(schema.medewerkers.id, body.medewerkerId));

  // AVG-trail: wie heeft wanneer wie goedgekeurd/ingetrokken?
  await logAudit(
    "medewerker_goedkeuring",
    body.medewerkerId,
    body.goedgekeurd ? "approve" : "revoke",
    null,
    { door: sessie.naam, rol: sessie.rol },
    {
      doorRol: sessie.rol,
      reden: body.goedgekeurd ? "Owner heeft account vrijgegeven" : "Goedkeuring ingetrokken",
      ipAdres: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
  );

  return NextResponse.json({ ok: true });
}
