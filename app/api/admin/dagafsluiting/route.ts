/**
 * GET  /api/admin/dagafsluiting?dept=kl&dagen=30
 *      → historie van dagafsluitingen voor manager/owner.
 *        Manager ziet alleen z'n eigen vestiging; owner mag filteren.
 *
 * POST /api/admin/dagafsluiting/[id] handled in [id]/route.ts (markeer
 *        gecontroleerd).
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { dagafsluitingenHistorie } from "@/lib/dagafsluiting";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const url = new URL(req.url);
  const reqDept = url.searchParams.get("dept");
  const dagen = Math.min(Math.max(Number(url.searchParams.get("dagen") ?? "30"), 1), 365);

  // Manager mag alleen eigen vestiging
  let dept: string | null = reqDept;
  if (sessie.rol === "manager" && sessie.vestiging) {
    dept = sessie.vestiging;
  }

  const totDate = new Date();
  const vanDate = new Date();
  vanDate.setDate(vanDate.getDate() - dagen);
  const fmt = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);

  const lijst = await dagafsluitingenHistorie(dept, fmt(vanDate), fmt(totDate));
  return NextResponse.json({ verzoeken: lijst, dept, dagen });
}
