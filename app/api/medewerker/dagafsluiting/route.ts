/**
 * GET  /api/medewerker/dagafsluiting?dept=kl&datum=2026-05-15
 *      → bestaande dagafsluiting (als ingediend) + verwachte cash + config
 * POST /api/medewerker/dagafsluiting
 *      → indienen / bijwerken
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import {
  dienDagafsluitingIn,
  haalDagafsluiting,
  verwachteContanteOmzet,
  totalePosOmzet,
  getVestigingConfig,
  DENOMINATIES,
} from "@/lib/dagafsluiting";

export const dynamic = "force-dynamic";

function vandaagISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

export async function GET(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const url = new URL(req.url);
  const datum = url.searchParams.get("datum") ?? vandaagISO();
  let dept = url.searchParams.get("dept");

  // Als geen dept gegeven, pak hoofd-vestiging van medewerker
  if (!dept) {
    const [m] = await db
      .select({ hoofdDeptId: schema.medewerkers.hoofdDepartmentId })
      .from(schema.medewerkers)
      .where(eq(schema.medewerkers.id, sessie.medewerkerId));
    if (m?.hoofdDeptId) {
      const [d] = await db.select({ slug: schema.departments.slug })
        .from(schema.departments).where(eq(schema.departments.id, m.hoofdDeptId));
      dept = d?.slug ?? null;
    }
    if (!dept) {
      // Fallback: eerste gekoppelde vestiging
      const [koppel] = await db
        .select({ slug: schema.departments.slug })
        .from(schema.medewerkerDepartments)
        .innerJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
        .where(eq(schema.medewerkerDepartments.medewerkerId, sessie.medewerkerId))
        .limit(1);
      dept = koppel?.slug ?? null;
    }
  }
  if (!dept) {
    return NextResponse.json({ error: "Medewerker is niet aan vestiging gekoppeld" }, { status: 400 });
  }

  const config = getVestigingConfig(dept);
  const [bestaand, verwachtContant, posOmzet] = await Promise.all([
    haalDagafsluiting(dept, datum),
    verwachteContanteOmzet(dept, datum),
    totalePosOmzet(dept, datum),
  ]);

  // Vorige dag — startkassa-check ("gisteren rapporteerden ze €153 stand")
  const vorigeDag = new Date(datum);
  vorigeDag.setUTCDate(vorigeDag.getUTCDate() - 1);
  const vorigeDagIso = vorigeDag.toISOString().slice(0, 10);
  const vorige = await haalDagafsluiting(dept, vorigeDagIso);

  return NextResponse.json({
    dept,
    datum,
    denominaties: DENOMINATIES,
    config,
    verwachtContant,
    posOmzetTotaal: posOmzet,
    bestaand: bestaand ? {
      contantGeteld: Number(bestaand.contantGeteldEur),
      fooi: Number(bestaand.fooiEur),
      enveloppe: Number(bestaand.enveloppeEur),
      kasVerschil: bestaand.kasVerschilEur ? Number(bestaand.kasVerschilEur) : null,
      verschilToelichting: bestaand.verschilToelichting,
      muntenTelling: bestaand.muntenTelling,
      temperaturen: bestaand.temperaturen,
      schoonmaakChecks: bestaand.schoonmaakChecks,
      enveloppeInKluis: bestaand.enveloppeInKluis,
      alleSchoonmaakVoltooid: bestaand.alleSchoonmaakVoltooid,
      notitie: bestaand.notitie,
      gecontroleerdDoor: bestaand.gecontroleerdDoor,
      ingediendOp: bestaand.ingediendOp.toISOString(),
    } : null,
    vorigeDag: vorige ? {
      datum: vorigeDagIso,
      contantGeteld: Number(vorige.contantGeteldEur),
      enveloppe: Number(vorige.enveloppeEur),
    } : null,
  });
}

interface PostBody {
  dept: string;
  datum: string;
  startkassaDoel?: number;
  munten: Record<string, number>;
  fooi?: number;
  temperaturen: Array<{ locatie: string; waardeC: number; opmerking?: string }>;
  schoonmaakChecks: Array<{ label: string; gedaan: boolean; opmerking?: string }>;
  alleSchoonmaakVoltooid: boolean;
  enveloppeInKluis: boolean;
  notitie?: string;
  verschilToelichting?: string;
}

export async function POST(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<PostBody>;
  if (!body.dept || !body.datum || !body.munten) {
    return NextResponse.json({ error: "dept, datum, munten zijn verplicht" }, { status: 400 });
  }

  const result = await dienDagafsluitingIn({
    deptSlug: body.dept,
    datum: body.datum,
    ingediendDoorId: sessie.medewerkerId,
    startkassaDoel: body.startkassaDoel ?? getVestigingConfig(body.dept).startkassaDoel,
    munten: body.munten,
    fooi: body.fooi ?? 0,
    temperaturen: body.temperaturen ?? [],
    schoonmaakChecks: body.schoonmaakChecks ?? [],
    alleSchoonmaakVoltooid: body.alleSchoonmaakVoltooid ?? false,
    enveloppeInKluis: body.enveloppeInKluis ?? false,
    notitie: body.notitie,
    verschilToelichting: body.verschilToelichting,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
