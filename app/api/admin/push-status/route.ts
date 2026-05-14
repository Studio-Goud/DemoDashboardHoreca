/**
 * GET /api/admin/push-status
 *   → { vapid, kv, telegram, email, subscribers }
 *
 * Owner-only diagnostic — laat zien welke notify-kanalen geconfigureerd
 * zijn EN hoeveel subscribers er actief zijn. Helpt om "ik krijg geen
 * notificaties" te debuggen zonder Vercel-dashboard te openen.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { pushGeconfigureerd } from "@/lib/push";
import { heeftNotifyConfig } from "@/lib/notify";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }

  const push = pushGeconfigureerd();
  const cfg = heeftNotifyConfig();

  let subscribers = 0;
  try {
    const lijst = await kv.get<unknown[]>("push:subscriptions");
    subscribers = Array.isArray(lijst) ? lijst.length : 0;
  } catch { /* KV niet beschikbaar */ }

  return NextResponse.json({
    push: { vapidGezet: push.vapid, kvBeschikbaar: push.kv },
    notify: { webpush: cfg.webpush, telegram: cfg.telegram, email: cfg.email },
    subscribers,
    klaarVoorGebruik: push.vapid && push.kv,
  });
}
