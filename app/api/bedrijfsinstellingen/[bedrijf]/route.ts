/**
 * GET  /api/bedrijfsinstellingen/[bedrijf]  → huidige instellingen (manager + owner)
 * PUT  /api/bedrijfsinstellingen/[bedrijf]  → instellingen wijzigen (owner only)
 *
 * Bevat o.a. de werkgeverslasten-opslag % die over bruto-loon wordt
 * gerekend. Wordt gebruikt in:
 *  - Inleen-doorberekening (optioneel)
 *  - Salaris-detail per medewerker
 *  - Loonkost-ratio in MaandPnL
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";

type Slug = "bb" | "sl" | "kl";
const GELDIGE = new Set<Slug>(["bb", "sl", "kl"]);

export async function GET(_req: Request, { params }: { params: { bedrijf: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (!GELDIGE.has(params.bedrijf as Slug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  await runAllePendingMigraties().catch(() => null);
  const [row] = await db
    .select({
      slug: schema.departments.slug,
      naam: schema.departments.naam,
      werkgeverslastenPct: schema.departments.werkgeverslastenPct,
    })
    .from(schema.departments)
    .where(eq(schema.departments.slug, params.bedrijf));
  if (!row) return NextResponse.json({ error: "bedrijf niet in DB" }, { status: 404 });
  return NextResponse.json({
    slug: row.slug,
    naam: row.naam,
    werkgeverslastenPct: row.werkgeverslastenPct === null ? 27 : Number(row.werkgeverslastenPct),
  });
}

export async function PUT(req: Request, { params }: { params: { bedrijf: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag instellingen wijzigen" }, { status: 403 });
  }
  if (!GELDIGE.has(params.bedrijf as Slug)) {
    return NextResponse.json({ error: "ongeldig bedrijf" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    werkgeverslastenPct?: number;
  };
  const updates: Record<string, unknown> = {};
  if (body.werkgeverslastenPct !== undefined) {
    const pct = Number(body.werkgeverslastenPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: "percentage tussen 0 en 100" }, { status: 400 });
    }
    updates.werkgeverslastenPct = pct.toFixed(2);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "geen velden om bij te werken" }, { status: 400 });
  }
  await db
    .update(schema.departments)
    .set(updates)
    .where(eq(schema.departments.slug, params.bedrijf));
  return NextResponse.json({ ok: true });
}
