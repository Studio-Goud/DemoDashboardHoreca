/**
 * Email-laag via Resend. Wordt gebruikt voor medewerker-uitnodigingen
 * en (later) wachtwoord-resets.
 *
 * Vereist env vars:
 *   RESEND_API_KEY  — re_xxxxxxxxxxxxx
 *   MAIL_FROM       — bv. "rooster@studiogoud.nl" (of "onboarding@resend.dev")
 */
import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY ontbreekt in environment variables");
  return new Resend(key);
}

function getMailFrom(): string {
  return process.env.MAIL_FROM || "onboarding@resend.dev";
}

function getBaseUrl(): string {
  // Voorkeur: NEXT_PUBLIC_BASE_URL (al in Vercel gezet). Fallback: VERCEL_URL.
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface UitnodigingMail {
  voornaam: string;
  email: string;
  token: string;       // registratie-token (URL-safe random string)
  bedrijfNaam: string; // "Brunch & Brew", "Saté Lounge", etc.
  bedrijfHex?: string; // accent-kleur voor knop
  verlooptOp: Date;
}

export async function verstuurUitnodiging(data: UitnodigingMail): Promise<{ id: string }> {
  const link = `${getBaseUrl()}/welkom?token=${encodeURIComponent(data.token)}`;
  const verlooptStr = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric", month: "long", year: "numeric",
  }).format(data.verlooptOp);

  const accent = data.bedrijfHex || "#0A84FF";

  const html = `
<!doctype html>
<html lang="nl">
<head><meta charset="utf-8" /><title>Welkom bij Studio Goud</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; background: #F5F5F7; margin: 0; padding: 40px 20px; color: #1D1D1F;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; padding: 32px; border: 1px solid rgba(0,0,0,0.08);">
    <tr><td>
      <p style="font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: #6E6E73; margin: 0 0 12px;">Studio Goud · ${data.bedrijfNaam}</p>
      <h1 style="font-size: 24px; font-weight: 600; letter-spacing: -0.019em; margin: 0 0 16px;">Welkom ${data.voornaam} 👋</h1>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px;">
        Je bent toegevoegd aan het Studio&nbsp;Goud rooster-systeem. Klik op onderstaande knop om je
        persoonlijke <strong>4-cijferige inlogcode</strong> aan te maken.
      </p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: ${accent}; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 22px; border-radius: 10px;">Inlogcode aanmaken</a>
      </p>
      <p style="font-size: 12px; color: #6E6E73; margin: 16px 0 0;">
        Deze link is geldig tot <strong>${verlooptStr}</strong>. Lukt de knop niet?
        Kopieer en plak deze link in je browser:<br/>
        <span style="word-break: break-all;">${link}</span>
      </p>
      <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.08); margin: 28px 0;" />
      <p style="font-size: 11px; color: #6E6E73; margin: 0;">
        Heb je deze mail onverwacht ontvangen? Negeer 'm dan — de link doet niets zonder dat je
        zelf een PIN instelt.
      </p>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text =
    `Welkom ${data.voornaam}\n\n` +
    `Je bent toegevoegd aan het Studio Goud rooster-systeem voor ${data.bedrijfNaam}.\n` +
    `Open de volgende link om je inlogcode aan te maken (geldig tot ${verlooptStr}):\n\n` +
    `${link}\n\n` +
    `Heb je deze mail onverwacht ontvangen? Negeer 'm dan.`;

  const resend = getResend();
  const from = getMailFrom();
  console.log("[mail] verstuurUitnodiging", { to: data.email, from });

  let res: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    res = await resend.emails.send({
      from,
      to: data.email,
      subject: `Welkom bij ${data.bedrijfNaam} — maak je inlogcode aan`,
      html,
      text,
    });
  } catch (e) {
    console.error("[mail] Resend SDK threw", e);
    throw new Error(`Resend SDK fout: ${e instanceof Error ? e.message : "onbekend"}`);
  }

  console.log("[mail] Resend response", JSON.stringify(res));

  if ("error" in res && res.error) {
    const errMsg = (res.error as { message?: string; name?: string }).message
      ?? (res.error as { name?: string }).name
      ?? JSON.stringify(res.error);
    console.error("[mail] Resend returned error", res.error);
    throw new Error(`Resend fout: ${errMsg}`);
  }
  // SDK retourneert { data: { id }, error: null }
  const id = "data" in res && res.data?.id ? res.data.id : "onbekend";
  console.log("[mail] verstuurUitnodiging klaar", { id });
  return { id };
}
