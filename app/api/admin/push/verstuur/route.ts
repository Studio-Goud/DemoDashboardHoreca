/**
 * POST /api/admin/push/verstuur
 *   body: { titel, bericht, doelgroep: { type, vestiging?, medewerkerIds? } }
 *   → { ok, doelgroep, verzonden, fouten }
 *
 * Bulk push-bericht van owner/manager naar medewerkers.
 *
 *   - Owner: mag alle vestigingen + alle medewerkers.
 *   - Manager: mag alleen z'n eigen vestiging.
 *
 * Doelgroep-types:
 *   { type: "vestiging", vestiging: "bb"|"sl"|"kl" } — alle actieve mws daar
 *   { type: "alle" }                                  — alle actieve mws (owner-only)
 *   { type: "selectie", medewerkerIds: number[] }     — specifieke mws
 *
 * Rate-limit: 5 verstuurde berichten per admin per uur (KV teller).
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { db, schema } from "@/lib/db/client";
import { stuurNaarMedewerkers, medewerkersInVestiging } from "@/lib/medewerker-push";
import { registreerPoging } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

interface DoelgroepBody {
  type: "vestiging" | "alle" | "selectie";
  vestiging?: "bb" | "sl" | "kl";
  medewerkerIds?: number[];
}

export async function POST(req: Request) {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  // Rate limit per admin (op naam — uniek genoeg binnen het kleine team).
  const rate = await registreerPoging(`admin-push:${sessie.naam}`, 5, 3600);
  if (rate.geblokkeerd) {
    return NextResponse.json(
      { error: `Te veel berichten. Probeer over ${Math.ceil(rate.restSec / 60)} min opnieuw.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    titel?: string;
    bericht?: string;
    doelgroep?: DoelgroepBody;
  };
  const titel   = body.titel?.trim();
  const bericht = body.bericht?.trim();
  if (!titel || !bericht) {
    return NextResponse.json({ error: "titel en bericht zijn verplicht" }, { status: 400 });
  }
  if (titel.length > 80 || bericht.length > 400) {
    return NextResponse.json({ error: "titel max 80, bericht max 400 tekens" }, { status: 400 });
  }
  if (!body.doelgroep) {
    return NextResponse.json({ error: "doelgroep ontbreekt" }, { status: 400 });
  }

  // Bepaal de uiteindelijke medewerker-ids op basis van rol + doelgroep
  let ids: number[] = [];
  let doelLabel = "";

  if (body.doelgroep.type === "vestiging") {
    const v = body.doelgroep.vestiging;
    if (!v) return NextResponse.json({ error: "vestiging vereist" }, { status: 400 });
    if (sessie.rol === "manager" && sessie.vestiging !== v) {
      return NextResponse.json(
        { error: "manager mag alleen eigen vestiging benaderen" },
        { status: 403 },
      );
    }
    ids = await medewerkersInVestiging(v);
    doelLabel = `vestiging ${v}`;
  } else if (body.doelgroep.type === "alle") {
    if (sessie.rol !== "owner") {
      return NextResponse.json(
        { error: "alleen owner mag naar alle vestigingen sturen" },
        { status: 403 },
      );
    }
    const rows = await db
      .select({ id: schema.medewerkers.id })
      .from(schema.medewerkers)
      .where(eq(schema.medewerkers.actief, true));
    ids = rows.map((r) => r.id);
    doelLabel = "alle vestigingen";
  } else if (body.doelgroep.type === "selectie") {
    const sel = body.doelgroep.medewerkerIds ?? [];
    if (sel.length === 0) {
      return NextResponse.json({ error: "selectie is leeg" }, { status: 400 });
    }
    // Manager mag alleen mws uit eigen vestiging selecteren
    if (sessie.rol === "manager" && sessie.vestiging) {
      const toegestaan = new Set(await medewerkersInVestiging(sessie.vestiging));
      const verboden = sel.filter((id) => !toegestaan.has(id));
      if (verboden.length > 0) {
        return NextResponse.json(
          { error: `selectie bevat medewerker(s) buiten je vestiging: ${verboden.join(", ")}` },
          { status: 403 },
        );
      }
    }
    ids = sel;
    doelLabel = `selectie (${sel.length})`;
  } else {
    return NextResponse.json({ error: "onbekend doelgroep-type" }, { status: 400 });
  }

  const resultaat = await stuurNaarMedewerkers(ids, {
    titel,
    body: bericht,
    url: "/m",
    tag: "admin-bericht",
  });

  await logAudit(
    "push_bericht",
    0,
    "create",
    null,
    {
      door: sessie.naam,
      rol: sessie.rol,
      doelgroep: doelLabel,
      titel,
      bericht,
      doelgroepAantal: resultaat.doelgroep,
      verzonden: resultaat.verzonden,
    },
    { doorRol: sessie.rol },
  );

  return NextResponse.json({ ok: true, doelLabel, ...resultaat });
}
