/**
 * POST /api/admin/push-test
 *   → stuurt een test-notificatie naar alle subscribers
 *
 * Owner-only. Handig om te checken of de hele pipeline (VAPID + KV +
 * service worker + device-subscription) werkt zonder op echte triggers
 * te hoeven wachten.
 */
import { NextResponse } from "next/server";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { notify, heeftNotifyConfig } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST() {
  const sessie = huidigeAdminSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });
  if (sessie.rol !== "owner") {
    return NextResponse.json({ error: "alleen owner" }, { status: 403 });
  }
  const cfg = heeftNotifyConfig();
  if (!cfg.webpush && !cfg.telegram && !cfg.email) {
    return NextResponse.json({ error: "Geen notify-kanaal geconfigureerd" }, { status: 500 });
  }
  const resultaten = await notify({
    onderwerp: "🔔 Test-notificatie",
    tekstPlatte: "Als je dit ziet werkt de push-pipeline. Klik om naar admin te gaan.",
    url: "/bb#admin",
    tag: "test-push",
  });
  return NextResponse.json({ ok: true, resultaten });
}
