/**
 * Push-laag voor medewerkers. DB-backed (medewerker_push_subs) zodat we
 * targeted kunnen sturen — bv. alleen naar collega's binnen dezelfde
 * vestiging. Het bestaande lib/push.ts (KV-based, anoniem) blijft
 * onaangeroerd voor admin/eigenaar gebruik (dagelijkse omzet-digest etc).
 *
 * Subscribe-flow: medewerker opent /m, browser vraagt push-permission via
 * components/medewerker/MedewerkerPushAanmelden.tsx → endpoint+keys →
 * POST /api/medewerker/push/subscribe → DB row gekoppeld aan medewerker_id.
 */
import webpush from "web-push";
import { eq, inArray, and, gt } from "drizzle-orm";
import { db, schema } from "./db/client";

function normaliseerVapidKey(raw: string): string {
  return raw.trim().replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function configureerWebpush(): void {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT || "mailto:info@brunchandbrew.nl";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID-sleutels ontbreken — zet env vars in Vercel.");
  }
  webpush.setVapidDetails(subject, normaliseerVapidKey(publicKey), normaliseerVapidKey(privateKey));
}

export interface PushPayload {
  titel: string;
  body: string;
  /** URL waar de service worker naar redirect bij klik op de notificatie. */
  url?: string;
  /** Notificatie-tag (gelijke tag overschrijft een vorige op het device). */
  tag?: string;
}

export interface PushVerzendResultaat {
  doelgroep: number;
  verzonden: number;
  fouten: number;
  verwijderd: number;
}

/** Stuur push naar specifieke medewerker-ids. Stille no-op bij lege lijst. */
export async function stuurNaarMedewerkers(
  medewerkerIds: number[],
  payload: PushPayload,
): Promise<PushVerzendResultaat> {
  if (medewerkerIds.length === 0) {
    return { doelgroep: 0, verzonden: 0, fouten: 0, verwijderd: 0 };
  }
  configureerWebpush();

  const subs = await db
    .select()
    .from(schema.medewerkerPushSubs)
    .where(inArray(schema.medewerkerPushSubs.medewerkerId, medewerkerIds));

  if (subs.length === 0) {
    return { doelgroep: medewerkerIds.length, verzonden: 0, fouten: 0, verwijderd: 0 };
  }

  const json = JSON.stringify({
    title: payload.titel,
    body:  payload.body,
    url:   payload.url ?? "/m",
    tag:   payload.tag ?? "mw-push",
  });

  let verzonden = 0;
  let fouten = 0;
  const teVerwijderen: number[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        json,
      );
      verzonden++;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; body?: string; message?: string };
      const sc = err.statusCode;
      if (sc === 404 || sc === 410) {
        teVerwijderen.push(sub.id);
      } else {
        console.error(`[mw-push] fout ${sc}: ${err.body ?? err.message}`);
        fouten++;
      }
    }
  }

  if (teVerwijderen.length > 0) {
    await db.delete(schema.medewerkerPushSubs)
      .where(inArray(schema.medewerkerPushSubs.id, teVerwijderen));
  }

  // Succes-timestamp bijwerken voor degenen die wel binnenkwamen
  if (verzonden > 0) {
    await db.update(schema.medewerkerPushSubs)
      .set({ laatsteSucces: new Date() })
      .where(inArray(schema.medewerkerPushSubs.medewerkerId, medewerkerIds));
  }

  return {
    doelgroep: medewerkerIds.length,
    verzonden,
    fouten,
    verwijderd: teVerwijderen.length,
  };
}

/** Alle actieve medewerkers binnen een vestiging — uit `medewerker_departments`. */
export async function medewerkersInVestiging(deptSlug: string, excludeIds: number[] = []): Promise<number[]> {
  const rows = await db
    .select({ id: schema.medewerkers.id })
    .from(schema.medewerkers)
    .innerJoin(schema.medewerkerDepartments, eq(schema.medewerkerDepartments.medewerkerId, schema.medewerkers.id))
    .innerJoin(schema.departments, eq(schema.medewerkerDepartments.departmentId, schema.departments.id))
    .where(and(
      eq(schema.departments.slug, deptSlug),
      eq(schema.medewerkers.actief, true),
    ));
  const ids = rows.map((r) => r.id);
  return excludeIds.length === 0 ? ids : ids.filter((id) => !excludeIds.includes(id));
}

/**
 * Cooldown-check: heeft deze medewerker in het laatste uur een ruilverzoek
 * óf een bulk-push verzonden? Voorkomt spam.
 */
export async function ruilverzoekCooldownActief(aanvragerId: number): Promise<boolean> {
  const eenUurGeleden = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ id: schema.ruilverzoeken.id })
    .from(schema.ruilverzoeken)
    .where(and(
      eq(schema.ruilverzoeken.aanvragerId, aanvragerId),
      gt(schema.ruilverzoeken.createdAt, eenUurGeleden),
    ))
    .limit(1);
  return rows.length > 0;
}
