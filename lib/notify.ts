// Verzendt notificaties via Telegram (als TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_IDS
// gezet zijn) en/of e-mail via Resend (als RESEND_API_KEY + DIGEST_EMAILS gezet).
// Beide kanalen zijn optioneel en werken naast elkaar.

interface NotificatieResultaat {
  kanaal: string;
  gelukt: boolean;
  fout?: string;
}

export interface Notificatie {
  onderwerp: string;
  tekstPlatte: string;     // voor Telegram / plain-text email
  htmlLichaam?: string;    // voor email; als leeg gebruiken we tekstPlatte
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

export async function notify(n: Notificatie): Promise<NotificatieResultaat[]> {
  const resultaten = [
    ...(await verstuurTelegram(n)),
    ...(await verstuurEmail(n)),
  ];
  // Console log zodat Vercel-logs altijd laten zien wat er zou zijn verstuurd
  console.log("[notify]", n.onderwerp, resultaten);
  return resultaten;
}

export function heeftNotifyConfig(): { telegram: boolean; email: boolean } {
  return {
    telegram: !!telegramConfig(),
    email: !!resendConfig(),
  };
}
