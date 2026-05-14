/**
 * POST /api/admin/bulk-uurlonen
 *   body: { vestiging: "bb"|"sl"|"kl", regels: [{ identifier: string, uurloon: number }] }
 *
 * Identifier kan zijn:
 *  - shiftbase_user_id (bv. "7", "18", "32")
 *  - "voornaam achternaam" (case-insensitive, exact match na trim)
 *  - alleen achternaam (uniek match)
 *
 * Zet uurloon + hoofd_department_id in één keer voor alle regels. Idempotent
 * — opnieuw aanroepen overschrijft de waarden, geen duplicaten. Owner-only.
 */
import { NextResponse } from "next/server";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { runAllePendingMigraties } from "@/lib/db/init-sql";

export const dynamic = "force-dynamic";

type Slug = "bb" | "sl" | "kl";
const GELDIGE = new Set<Slug>(["bb", "sl", "kl"]);

interface InvoerRegel {
  identifier: string;
  uurloon: number;
}

interface RegelResultaat {
  identifier: string;
  matched: boolean;
  medewerker?: { id: number; naam: string; oudUurloon: number | null; nieuwUurloon: number };
  reden?: string;
}

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner mag bulk-importeren" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    vestiging?: string;
    regels?: InvoerRegel[];
  };

  if (!body.vestiging || !GELDIGE.has(body.vestiging as Slug)) {
    return NextResponse.json({ error: "vestiging verplicht (bb/sl/kl)" }, { status: 400 });
  }
  if (!Array.isArray(body.regels) || body.regels.length === 0) {
    return NextResponse.json({ error: "regels[] verplicht" }, { status: 400 });
  }

  await runAllePendingMigraties().catch(() => null);

  // Department-id voor hoofd-vestiging
  const [dept] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.slug, body.vestiging));
  if (!dept) {
    return NextResponse.json({ error: "vestiging niet in DB" }, { status: 500 });
  }

  const resultaten: RegelResultaat[] = [];

  for (const regel of body.regels) {
    const id = (regel.identifier ?? "").trim();
    const uurloon = Number(regel.uurloon);
    if (!id || !Number.isFinite(uurloon) || uurloon <= 0) {
      resultaten.push({ identifier: id || "(leeg)", matched: false, reden: "ongeldige invoer" });
      continue;
    }

    // 1. Match op shiftbase_user_id (digits-only)
    let matches: Array<{ id: number; voornaam: string; achternaam: string; uurloon: string | null }> = [];
    if (/^\d+$/.test(id)) {
      matches = await db
        .select({
          id: schema.medewerkers.id,
          voornaam: schema.medewerkers.voornaam,
          achternaam: schema.medewerkers.achternaam,
          uurloon: schema.medewerkers.uurloon,
        })
        .from(schema.medewerkers)
        .where(eq(schema.medewerkers.shiftbaseUserId, id));
    }

    // 2. Match op "voornaam achternaam" (case-insensitive)
    if (matches.length === 0 && /\s/.test(id)) {
      const [vn, ...rest] = id.split(/\s+/);
      const an = rest.join(" ");
      matches = await db
        .select({
          id: schema.medewerkers.id,
          voornaam: schema.medewerkers.voornaam,
          achternaam: schema.medewerkers.achternaam,
          uurloon: schema.medewerkers.uurloon,
        })
        .from(schema.medewerkers)
        .where(and(
          ilike(schema.medewerkers.voornaam, vn),
          ilike(schema.medewerkers.achternaam, an),
        ));
    }

    // 3. Match op alleen achternaam — partial OK als uniek
    if (matches.length === 0) {
      matches = await db
        .select({
          id: schema.medewerkers.id,
          voornaam: schema.medewerkers.voornaam,
          achternaam: schema.medewerkers.achternaam,
          uurloon: schema.medewerkers.uurloon,
        })
        .from(schema.medewerkers)
        .where(or(
          ilike(schema.medewerkers.achternaam, `%${id}%`),
          ilike(schema.medewerkers.voornaam, `%${id}%`),
        ));
    }

    if (matches.length === 0) {
      resultaten.push({ identifier: id, matched: false, reden: "geen medewerker gevonden" });
      continue;
    }
    if (matches.length > 1) {
      resultaten.push({
        identifier: id,
        matched: false,
        reden: `${matches.length} matches gevonden — gebruik shiftbase_user_id of volledige naam`,
      });
      continue;
    }

    const m = matches[0];
    await db
      .update(schema.medewerkers)
      .set({
        uurloon: uurloon.toFixed(2),
        hoofdDepartmentId: dept.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.medewerkers.id, m.id));

    resultaten.push({
      identifier: id,
      matched: true,
      medewerker: {
        id: m.id,
        naam: `${m.voornaam} ${m.achternaam}`,
        oudUurloon: m.uurloon === null ? null : Number(m.uurloon),
        nieuwUurloon: uurloon,
      },
    });
  }

  const succesvol = resultaten.filter((r) => r.matched).length;
  return NextResponse.json({
    ok: true,
    succesvol,
    totaal: resultaten.length,
    resultaten,
  });
}

// Voorkom unused-warning op `sql` import (Drizzle re-export check)
void sql;
