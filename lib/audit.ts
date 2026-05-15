/**
 * Audit-log helpers.
 *
 * Onveranderlijke log van elke create/update/delete op kritieke entiteiten:
 * rosters (geplande diensten) en klok_events (in/uit klokken).
 *
 * Doel: nooit uren-data verliezen. Bij elke wijziging schrijven we een
 * snapshot van de oude én nieuwe waarde, samen met wie de wijziging deed.
 * Hiermee kan een manager altijd reconstrueren wat er is gebeurd.
 *
 * Deze module is APPEND-ONLY: er is geen update/delete functie. Records
 * blijven voor altijd staan zoals ze zijn ingevoegd.
 */

import { db, schema } from "./db/client";

export type AuditEntiteit =
  | "roster"
  | "klok_event"
  | "medewerker"
  // AVG/GDPR-trail: elke decryptie van BSN / document = log-regel,
  // elke goedkeuring/intrekking ook. Voldoet aan art.30 verwerking.
  | "medewerker_bsn"
  | "medewerker_document"
  | "medewerker_goedkeuring";
export type AuditActie = "create" | "update" | "delete" | "decrypt" | "approve" | "revoke";
export type AuditRol = "owner" | "manager" | "medewerker" | "systeem";

interface AuditContext {
  doorMedewerkerId?: number | null;
  doorRol?: AuditRol;
  reden?: string;
  ipAdres?: string;
  userAgent?: string;
}

/**
 * Log een wijziging. Faalt NOOIT — bij een DB-fout loggen we naar console
 * maar laten we de hoofd-operatie doorgaan (we willen niet dat een audit-fout
 * een legitieme actie blokkeert).
 */
export async function logAudit(
  entiteit: AuditEntiteit,
  entiteitId: number | string,
  actie: AuditActie,
  oudeWaarde: unknown,
  nieuweWaarde: unknown,
  ctx: AuditContext = {},
): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      entiteit,
      entiteitId: typeof entiteitId === "string" ? Number(entiteitId) : entiteitId,
      actie,
      doorMedewerkerId: ctx.doorMedewerkerId ?? null,
      doorRol: ctx.doorRol ?? "systeem",
      oudeWaarde: oudeWaarde === null || oudeWaarde === undefined
        ? null
        : JSON.stringify(oudeWaarde),
      nieuweWaarde: nieuweWaarde === null || nieuweWaarde === undefined
        ? null
        : JSON.stringify(nieuweWaarde),
      reden: ctx.reden ?? null,
      ipAdres: ctx.ipAdres ?? null,
      userAgent: ctx.userAgent ?? null,
    });
  } catch (e) {
    // Bewust niet throwen: een audit-fout mag een legitieme actie niet blokkeren.
    // Wel duidelijk loggen zodat we kunnen ingrijpen.
    console.error("[AUDIT] Kon audit-log niet schrijven:", {
      entiteit,
      entiteitId,
      actie,
      foutMelding: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Haal de volledige audit-historie van één entiteit op (nieuwste eerst).
 * Geeft alle wijzigingen vanaf create tot nu — handig voor reconstructie.
 */
export async function audithistorie(
  entiteit: AuditEntiteit,
  entiteitId: number | string,
): Promise<schema.AuditLog[]> {
  const id = typeof entiteitId === "string" ? Number(entiteitId) : entiteitId;
  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(
      // Drizzle's `and` met `eq` voor compacte where
      // (importeer eq/and uit drizzle-orm aan top, zie hieronder)
      andEq(schema.auditLog.entiteit, entiteit, schema.auditLog.entiteitId, id),
    )
    .orderBy(descCreatedAt());
  return rows;
}

// Helpers om imports compact te houden — losse functies omdat we anders
// veel drizzle-orm symbolen moeten importeren op call-sites
import { and, eq, desc } from "drizzle-orm";

function andEq<T extends { entiteit: typeof schema.auditLog.entiteit; entiteitId: typeof schema.auditLog.entiteitId }>(
  entiteitCol: T["entiteit"],
  entiteitVal: AuditEntiteit,
  idCol: T["entiteitId"],
  idVal: number,
) {
  return and(eq(entiteitCol, entiteitVal), eq(idCol, idVal));
}

function descCreatedAt() {
  return desc(schema.auditLog.createdAt);
}

/**
 * Snapshot helper: vat een Roster row samen tot wat we willen loggen.
 * Vermijdt grote createdAt/updatedAt blobs in JSON.
 */
export function snapshotRoster(r: typeof schema.rosters.$inferSelect): Record<string, unknown> {
  return {
    id: r.id,
    medewerkerId: r.medewerkerId,
    departmentId: r.departmentId,
    shiftTemplateId: r.shiftTemplateId,
    datum: r.datum,
    start: r.start,
    eind: r.eind,
    pauzeMin: r.pauzeMin,
    notitie: r.notitie,
    gepubliceerd: r.gepubliceerd,
  };
}

/**
 * Snapshot helper voor klok_events.
 */
export function snapshotKlokEvent(k: typeof schema.klokEvents.$inferSelect): Record<string, unknown> {
  return {
    id: k.id,
    medewerkerId: k.medewerkerId,
    rosterId: k.rosterId,
    type: k.type,
    tijdstempel: k.tijdstempel,
    latitude: k.latitude,
    longitude: k.longitude,
    notitie: k.notitie,
    handmatig: k.handmatig,
    gewijzigdDoor: k.gewijzigdDoor,
  };
}
