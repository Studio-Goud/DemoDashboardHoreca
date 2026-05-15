import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner" && sessie.rol !== "manager") {
    return NextResponse.json({ error: "alleen owner/manager" }, { status: 403 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ongeldig id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { verborgen?: boolean };
  if (typeof body.verborgen !== "boolean") {
    return NextResponse.json({ error: "verborgen (bool) verplicht" }, { status: 400 });
  }

  await db.update(schema.feedbackReviews)
    .set({ verborgen: body.verborgen })
    .where(eq(schema.feedbackReviews.id, id));

  return NextResponse.json({ ok: true });
}
