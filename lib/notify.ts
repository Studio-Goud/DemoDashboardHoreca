// Verzendt notificaties via Web Push (PWA, primair), Telegram (optioneel)
// en/of e-mail via Resend (optioneel). Alle kanalen zijn onafhankelijk en
// kunnen naast elkaar actief zijn.

import { stuurPush as stuurWebPush, pushGeconfigureerd } from "./push";

interface NotificatieResultaat {
  kanaal: string;
  gelukt: boolean;
  fout?: string;
}

export interface Notificatie {
  onderwerp: string;
  tekstPlatte: string;     // voor Telegram / plain-text email / web push body
  htmlLichaam?: string;    // voor email; als leeg gebruiken we tekstPlatte
  url?: string;            // web push click-target
  tag?: string;            // web push tag (dedup)
}

// ---------- Telegram ----------

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = process.env.TELEGRAM_CHAT_IDS; // comma-sep
  if (!token || !chats) return null;
  return { token, chats: chats.split(",").map((s) => s.trim()).filter(Boolean) };
}

async function verstuurTelegram(n: Notificatie): Promise<NotificatieResultaat[]> {
  const cfg = telegramConfig();
  if (!cfg) return [];
  const resultaten: NotificatieResultaat[] = [];
  const tekst = `*${n.onderwerp}*\n\n${n.tekstPlatte}`;
  for (const chat of cfg.chats) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${cfg.token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chat,
            text: tekst,
            parse_mode: "Markdown",
          }),
        }
      );
      if (!res.ok) {
        const foutTekst = await res.text();
        resultaten.push({
          kanaal: `telegram:${chat}`,
          gelukt: false,
          fout: foutTekst,
        });
      } else {
        resultaten.push({ kanaal: `telegram:${chat}`, gelukt: true });
      }
    } catch (e) {
      resultaten.push({
        kanaal: `telegram:${chat}`,
        gelukt: false,
        fout: e instanceof Error ? e.message : "onbekend",
      });
    }
  }
  return resultaten;
}

// ---------- Resend (e-mail) ----------

function resendConfig() {
  const key = process.env.RESEND_API_KEY;
  const emails = process.env.DIGEST_EMAILS; // comma-sep
  const vanAdres = process.env.DIGEST_FROM ?? "Omzet Dashboard <onboarding@resend.dev>";
  if (!key || !emails) return null;
  return {
    key,
    to: emails.split(",").map((s) => s.trim()).filter(Boolean),
    from: vanAdres,
  };
}

async function verstuurEmail(n: Notificatie): Promise<NotificatieResultaat[]> {
  const cfg = resendConfig();
  if (!cfg) return [];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: cfg.to,
        subject: n.onderwerp,
        text: n.tekstPlatte,
        html: n.htmlLichaam ?? n.tekstPlatte.replace(/\n/g, "<br>"),
      }),
    });
    if (!res.ok) {
      const fout = await res.text();
      return [{ kanaal: "resend", gelukt: false, fout }];
    }
    return [{ kanaal: "resend", gelukt: true }];
  } catch (e) {
    return [
      {
        kanaal: "resend",
        gelukt: false,
        fout: e instanceof Error ? e.message : "onbekend",
      },
    ];
  }
}

// ---------- Publieke API ----------

async function verstuurWebPush(n: Notificatie): Promise<NotificatieResultaat[]> {
  const cfg = pushGeconfigureerd();
  if (!cfg.vapid || !cfg.kv) return [];
  try {
    const res = await stuurWebPush(n.onderwerp, n.tekstPlatte, {
      url: n.url ?? "/",
      tag: n.tag ?? "omzet",
    });
    return [
      {
        kanaal: "webpush",
        gelukt: true,
        fout: res.verzonden === 0 ? "geen abonnees" : undefined,
      },
    ];
  } catch (e) {
    return [
      {
        kanaal: "webpush",
        gelukt: false,
        fout: e instanceof Error ? e.message : "onbekend",
      },
    ];
  }
}

export async function notify(n: Notificatie): Promise<NotificatieResultaat[]> {
  const resultaten = [
    ...(await verstuurWebPush(n)),
    ...(await verstuurTelegram(n)),
    ...(await verstuurEmail(n)),
  ];
  console.log("[notify]", n.onderwerp, resultaten);
  return resultaten;
}

export function heeftNotifyConfig(): {
  webpush: boolean;
  telegram: boolean;
  email: boolean;
} {
  const p = pushGeconfigureerd();
  return {
    webpush: p.vapid && p.kv,
    telegram: !!telegramConfig(),
    email: !!resendConfig(),
  };
}
