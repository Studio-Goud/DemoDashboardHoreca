/**
 * POST   /api/medewerker/push/subscribe       — registreer push-subscription voor sessie-medewerker
 * DELETE /api/medewerker/push/subscribe?endpoint=…  — afmelden
 * GET    /api/medewerker/push/subscribe       — status (geconfigureerd? aantal eigen subs?)
 *
 * Subscriptions worden gekoppeld aan de medewerker-sessie (cookie). Geen
 * losse "naam" zoals in de KV-variant — owner kan in admin-panel zien wie
 * notificaties heeft aanstaan via de medewerker-activiteit view.
 */
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function vapidGeconfigureerd(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function POST(req: Request) {
  if (!vapidGeconfigureerd()) {
    return NextResponse.json(
      { error: "VAPID-sleutels ontbreken op de server" },
      { status: 500 },
    );
  }
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subscription?: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    deviceLabel?: string;
  };
  if (!body.subscription?.endpoint || !body.subscription.keys) {
    return NextResponse.json({ error: "subscription ontbreekt" }, { status: 400 });
  }

  // Idempotent: bij her-registratie van zelfde endpoint upserten we.
  await db.insert(schema.medewerkerPushSubs).values({
    medewerkerId: sessie.medewerkerId,
    endpoint: body.subscription.endpoint,
    p256dh: body.subscription.keys.p256dh,
    auth: body.subscription.keys.auth,
    deviceLabel: body.deviceLabel?.trim() || null,
  }).onConflictDoUpdate({
    target: schema.medewerkerPushSubs.endpoint,
    set: {
      medewerkerId: sessie.medewerkerId,
      p256dh: body.subscription.keys.p256dh,
      auth: body.subscription.keys.auth,
      deviceLabel: body.deviceLabel?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  }
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint vereist" }, { status: 400 });
  }
  await db.delete(schema.medewerkerPushSubs).where(and(
    eq(schema.medewerkerPushSubs.medewerkerId, sessie.medewerkerId),
    eq(schema.medewerkerPushSubs.endpoint, endpoint),
  ));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const sessie = await huidigeSessie();
  if (!sessie || sessie.rol !== "medewerker") {
    return NextResponse.json({ aantal: 0, vapidGeconfigureerd: vapidGeconfigureerd() });
  }
  const rows = await db
    .select({ id: schema.medewerkerPushSubs.id, endpoint: schema.medewerkerPushSubs.endpoint })
    .from(schema.medewerkerPushSubs)
    .where(eq(schema.medewerkerPushSubs.medewerkerId, sessie.medewerkerId));
  return NextResponse.json({
    aantal: rows.length,
    endpoints: rows.map((r) => r.endpoint),
    vapidGeconfigureerd: vapidGeconfigureerd(),
  });
}
