import { huidigeSessie } from "@/lib/auth";
import { redirect } from "next/navigation";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import MedewerkerRooster from "@/components/medewerker/MedewerkerRooster";
import MijnScore from "@/components/MijnScore";
import VerjaardagsViering from "@/components/medewerker/VerjaardagsViering";
import RuilverzoekenInbox from "@/components/medewerker/RuilverzoekenInbox";
import MedewerkerPushAanmelden from "@/components/medewerker/MedewerkerPushAanmelden";
import MedewerkerPushBanner from "@/components/medewerker/MedewerkerPushBanner";
import Link from "next/link";

export const dynamic = "force-dynamic";

function vandaagISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}
function isoPlus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}

export default async function MedewerkerHome() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") redirect("/m/login");

  // Eerst PIN-reset afdwingen bij bulk-geseede accounts (default "1234")
  if (sessie.moetPinResetten) redirect("/m/pin-resetten");

  // Gate-check: medewerker moet onboarding voltooid + goedgekeurd hebben.
  // Tegelijk halen we voornaam + geboortedatum op voor de verjaardags-viering.
  const [m] = await db.select({
    voornaam: schema.medewerkers.voornaam,
    onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
    goedgekeurd: schema.medewerkers.goedgekeurd,
    geboortedatum: schema.medewerkers.geboortedatum,
  }).from(schema.medewerkers).where(eq(schema.medewerkers.id, sessie.medewerkerId));
  if (!m) redirect("/m/login");
  if (!m.onboardingVoltooid) redirect("/m/profiel");
  if (!m.goedgekeurd) redirect("/m/wachten");

  const start = vandaagISO();
  const eind = isoPlus(14);

  // Eigen diensten komende 2 weken (gepubliceerd)
  const rows = await db.select({
    id: schema.rosters.id,
    datum: schema.rosters.datum,
    start: schema.rosters.start,
    eind: schema.rosters.eind,
    pauzeMin: schema.rosters.pauzeMin,
    gepubliceerd: schema.rosters.gepubliceerd,
    notitie: schema.rosters.notitie,
    t_korte: schema.shiftTemplates.korteNaam,
    t_lange: schema.shiftTemplates.langeNaam,
    d_slug: schema.departments.slug,
    d_naam: schema.departments.naam,
    d_hex: schema.departments.hex,
  })
    .from(schema.rosters)
    .innerJoin(schema.departments, eq(schema.rosters.departmentId, schema.departments.id))
    .leftJoin(schema.shiftTemplates, eq(schema.rosters.shiftTemplateId, schema.shiftTemplates.id))
    .where(and(
      eq(schema.rosters.medewerkerId, sessie.medewerkerId),
      eq(schema.rosters.gepubliceerd, true),
      gte(schema.rosters.datum, start),
      lte(schema.rosters.datum, eind),
    ))
    .orderBy(asc(schema.rosters.datum), asc(schema.rosters.start));

  const diensten = rows.map((r) => ({
    id: String(r.id),
    datum: r.datum,
    start: r.start.slice(0, 5),
    eind:  r.eind.slice(0, 5),
    pauzeMin: r.pauzeMin,
    notitie: r.notitie ?? "",
    shiftType: r.t_lange || r.t_korte || "",
    vestiging: { slug: r.d_slug, naam: r.d_naam, hex: r.d_hex },
  }));

  return (
    <div className="space-y-5">
      <VerjaardagsViering
        voornaam={m.voornaam}
        geboortedatum={m.geboortedatum}
        vandaag={start}
      />
      <MedewerkerPushBanner />
      <MedewerkerRooster
        naam={sessie.naam}
        diensten={diensten}
        vandaag={start}
      />
      <RuilverzoekenInbox />

      <Link
        href="/m/dagafsluiting"
        className="block rounded-2xl p-4 transition-transform active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #0A84FF15 0%, #30B26F15 100%)",
          border: "1px solid #0A84FF55",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[28px]">🧹</span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              Schoonmaak &amp; Kasrapport
            </p>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Einde van je dienst — vul kas, temperaturen en schoonmaak in
            </p>
          </div>
          <span className="text-[18px]" style={{ color: "#0A84FF" }}>→</span>
        </div>
      </Link>

      <MijnScore />
      <MedewerkerPushAanmelden />
    </div>
  );
}
