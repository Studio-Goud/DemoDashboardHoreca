import webpush from "web-push";
import { kv } from "@vercel/kv";

const KV_SLEUTEL = "push:subscriptions";

export interface OpgeslagenSubscription {
  id: string;                   // endpoint hash
  endpoint: string;
  keys: { p256dh: string; auth: string };
  naam?: string;                 // optioneel: wie dit is
  gemaakt: string;
}

function configureerWebpush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:ricardo@studio-goud.nl";
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID sleutels ontbreken — zet NEXT_PUBLIC_VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY in Vercel env."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function kvBeschikbaar(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function endpointHash(endpoint: string): Promise<string> {
  // Simpele hash zodat we duplicate endpoints kunnen detecteren
  const data = new TextEncoder().encode(endpoint);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function alleSubscriptions(): Promise<OpgeslagenSubscription[]> {
  if (!kvBeschikbaar()) return [];
  try {
    const data = (await kv.get<OpgeslagenSubscription[]>(KV_SLEUTEL)) ?? [];
    return data;
  } catch (e) {
    console.error("KV lezen mislukt:", e);
    return [];
  }
}

export async function voegSubscriptionToe(
  sub: Omit<OpgeslagenSubscription, "id" | "gemaakt">
): Promise<OpgeslagenSubscription> {
  if (!kvBeschikbaar()) {
    throw new Error(
      "Vercel KV niet geconfigureerd — voeg eerst een KV/Redis-store toe in Vercel → Storage."
    );
  }
  const id = await endpointHash(sub.endpoint);
  const item: OpgeslagenSubscription = {
    id,
    endpoint: sub.endpoint,
    keys: sub.keys,
    naam: sub.naam,
    gemaakt: new Date().toISOString(),
  };
  const huidig = await alleSubscriptions();
  // Verwijder bestaande met zelfde endpoint (her-registratie)
  const gefilterd = huidig.filter((s) => s.id !== id);
  gefilterd.push(item);
  await kv.set(KV_SLEUTEL, gefilterd);
  return item;
}

export async function verwijderSubscription(id: string): Promise<void> {
  if (!kvBeschikbaar()) return;
  const huidig = await alleSubscriptions();
  const nieuw = huidig.filter((s) => s.id !== id);
  await kv.set(KV_SLEUTEL, nieuw);
}

export async function stuurPush(
  onderwerp: string,
  body: string,
  extra: { url?: string; tag?: string } = {}
): Promise<{ verzonden: number; verwijderd: number }> {
  if (!kvBeschikbaar()) return { verzonden: 0, verwijderd: 0 };
  configureerWebpush();
  const subs = await alleSubscriptions();
  const payload = JSON.stringify({
    title: onderwerp,
    body,
    url: extra.url ?? "/",
    tag: extra.tag ?? "omzet",
  });

  let verzonden = 0;
  const teVerwijderen: string[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payload
      );
      verzonden++;
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      // 404 = subscription bestaat niet meer, 410 = gone
      if (err.statusCode === 404 || err.statusCode === 410) {
        teVerwijderen.push(sub.id);
      } else {
        console.error(`Push naar ${sub.id} mislukt:`, e);
      }
    }
  }
  if (teVerwijderen.length > 0) {
    const nieuw = subs.filter((s) => !teVerwijderen.includes(s.id));
    await kv.set(KV_SLEUTEL, nieuw);
  }
  return { verzonden, verwijderd: teVerwijderen.length };
}

export function pushGeconfigureerd(): {
  vapid: boolean;
  kv: boolean;
} {
  return {
    vapid: !!(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ),
    kv: kvBeschikbaar(),
  };
}
