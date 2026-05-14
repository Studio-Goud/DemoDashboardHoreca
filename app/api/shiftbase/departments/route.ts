/**
 * Lijst van alle departments (vestigingen). Gebruikt door MedewerkerBeheer
 * voor de "thuis-vestiging" dropdown.
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ id: schema.departments.id, slug: schema.departments.slug, naam: schema.departments.naam })
    .from(schema.departments);
  return NextResponse.json(rows);
}
