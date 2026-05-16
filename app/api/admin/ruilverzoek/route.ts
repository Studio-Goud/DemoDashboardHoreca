/**
 * GET /api/admin/ruilverzoek
 *   → lijst van verzoeken met status 'gereserveerd' (wachten op goedkeuring).
 *     Owner: alle vestigingen. Manager: alleen z'n eigen.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { teBeoordelen } from "@/lib/ruilverzoeken";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const filter = sessie.rol === "manager" ? sessie.vestiging ?? undefined : undefined;
  const lijst = await teBeoordelen(filter);
  return NextResponse.json({ verzoeken: lijst });
}
