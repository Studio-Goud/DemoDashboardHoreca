import { NextRequest, NextResponse } from "next/server";
import {
  voegSubscriptionToe,
  verwijderSubscription,
  alleSubscriptions,
  pushGeconfigureerd,
} from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cfg = pushGeconfigureerd();
  if (!cfg.vapid) {
    return NextResponse.json(
      {
        error:
          "VAPID sleutels niet geconfigureerd op de server. Zet NEXT_PUBLIC_VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY in Vercel env vars.",
      },
      { status: 500 }
    );
  }
  if (!cfg.kv) {
    return NextResponse.json(
      {
        error:
          "Vercel KV niet geconfigureerd. Ga naar Vercel → Storage → Create Database → Redis (Upstash). Die voegt automatisch KV_REST_API_URL en KV_REST_API_TOKEN toe.",
      },
      { status: 500 }
    );
  }

  let body: {
    subscription?: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    naam?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON body" }, { status: 400 });
  }

  if (!body.subscription?.endpoint || !body.subscription?.keys) {
    return NextResponse.json(
      { error: "subscription ontbreekt of onvolledig" },
      { status: 400 }
    );
  }

  try {
    const opgeslagen = await voegSubscriptionToe({
      endpoint: body.subscription.endpoint,
      keys: body.subscription.keys,
      naam: body.naam,
    });
    return NextResponse.json({ ok: true, id: opgeslagen.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const endpoint = url.searchParams.get("endpoint");
  if (!id && !endpoint) {
    return NextResponse.json(
      { error: "id of endpoint query-param vereist" },
      { status: 400 }
    );
  }
  try {
    if (id) {
      await verwijderSubscription(id);
    } else if (endpoint) {
      const subs = await alleSubscriptions();
      const match = subs.find((s) => s.endpoint === endpoint);
      if (match) await verwijderSubscription(match.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cfg = pushGeconfigureerd();
  const subs = cfg.kv ? await alleSubscriptions() : [];
  return NextResponse.json({
    configured: cfg,
    aantal: subs.length,
    subscriptions: subs.map((s) => ({
      id: s.id,
      naam: s.naam,
      gemaakt: s.gemaakt,
    })),
  });
}
