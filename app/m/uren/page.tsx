import { redirect } from "next/navigation";
import { huidigeSessie } from "@/lib/auth";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import MedewerkerUren from "@/components/medewerker/MedewerkerUren";

export const dynamic = "force-dynamic";

function eersteVanMaand(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
function laatsteVanMaand(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dag = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${y}-${m}-${String(dag).padStart(2, "0")}`;
}
function maandLabel(d: Date): string {
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(d);
}

export default async function MedewerkerUrenPage({ searchParams }: {
  searchParams: { maand?: string }
}) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");

  const peilDatum = searchParams.maand
    ? new Date(`${searchParams.maand}-15T12:00:00Z`)
    : new Date();
  const start = eersteVanMaand(peilDatum);
  const eind  = laatsteVanMaand(peilDatum);

  const rows = await db.select({
    id: schema.rosters.id,
    datum: schema.rosters.datum,
    start: schema.rosters.start,
    eind: schema.rosters.eind,
    pauzeMin: schema.rosters.pauzeMin,
    gepubliceerd: schema.rosters.gepubliceerd,
    t_lange: schema.shiftTemplates.langeNaam,
    d_naam: schema.departments.naam,
    d_hex: schema.departments.hex,
  })
    .from(schema.rosters)
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .leftJoin(schema.shiftTemplates, eq(schema.rosters.shiftTemplateId, schema.shiftTemplates.id))
    .where(and(
      eq(schema.rosters.medewerkerId, sessie.medewerkerId),
      gte(schema.rosters.datum, start),
      lte(schema.rosters.datum, eind),
    ))
    .orderBy(asc(schema.rosters.datum), asc(schema.rosters.start));

  const diensten = rows.map((r) => ({
    id: String(r.id),
    datum: r.datum,
    start: r.start.slice(0, 5),
    eind: r.eind.slice(0, 5),
    pauzeMin: r.pauzeMin,
    gepubliceerd: r.gepubliceerd,
    type: r.t_lange ?? "",
    vestiging: { naam: r.d_naam, hex: r.d_hex },
  }));

  const huidigeMaandIso = `${peilDatum.getFullYear()}-${String(peilDatum.getMonth() + 1).padStart(2, "0")}`;
  const vorige = new Date(peilDatum.getFullYear(), peilDatum.getMonth() - 1, 15);
  const volgende = new Date(peilDatum.getFullYear(), peilDatum.getMonth() + 1, 15);

  return (
    <MedewerkerUren
      maandLabel={maandLabel(peilDatum)}
      huidigeMaandIso={huidigeMaandIso}
      vorigeMaandIso={`${vorige.getFullYear()}-${String(vorige.getMonth() + 1).padStart(2, "0")}`}
      volgendeMaandIso={`${volgende.getFullYear()}-${String(volgende.getMonth() + 1).padStart(2, "0")}`}
      diensten={diensten}
    />
  );
}
