import { ImapFlow } from "imapflow";

export interface RuweFactuur {
  uid: number;
  datum: string;       // YYYY-MM-DD
  van: string;
  onderwerp: string;
  bestandsnaam: string;
  pdfBuffer: Buffer;
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  mailbox?: string;
}

export function oneComConfig(user: string, password: string): ImapConfig {
  return { host: "mail.one.com", port: 993, user, password, mailbox: "INBOX" };
}

export async function haalFactuurPdfs(
  config: ImapConfig,
  sindsDate: Date
): Promise<RuweFactuur[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.password },
    logger: false,
  });

  const resultaten: RuweFactuur[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.mailbox ?? "INBOX");

    try {
      // Zoek UIDs van emails vanaf sindsDate
      const uids = await client.search({ since: sindsDate }, { uid: true });
      if (!uids || uids.length === 0) return [];

      // Fetch envelope + bodyStructure per UID
      for await (const bericht of client.fetch(
        uids,
        { envelope: true, bodyStructure: true },
        { uid: true }
      )) {
        const uid = bericht.uid;
        const envelope = bericht.envelope;
        const datum = envelope?.date
          ? envelope.date.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const van = envelope?.from?.[0]?.address ?? "";
        const onderwerp = envelope?.subject ?? "";

        const pdfParts = zoekPdfParts(bericht.bodyStructure);
        if (pdfParts.length === 0) continue;

        for (const part of pdfParts) {
          try {
            const download = await client.download(`${uid}`, part.part, { uid: true });
            if (!download?.content) continue;

            const chunks: Buffer[] = [];
            for await (const buf of download.content) {
              chunks.push(buf as Buffer);
            }
            if (chunks.length === 0) continue;

            resultaten.push({
              uid,
              datum,
              van,
              onderwerp,
              bestandsnaam: part.naam,
              pdfBuffer: Buffer.concat(chunks),
            });
          } catch {
            // Skip onleesbare bijlage
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return resultaten;
}

interface PdfPart {
  part: string;
  naam: string;
}

function zoekPdfParts(struct: unknown, prefix = ""): PdfPart[] {
  if (!struct || typeof struct !== "object") return [];
  const s = struct as Record<string, unknown>;
  const resultaten: PdfPart[] = [];

  const type = String(s.type ?? "").toLowerCase();
  const subtype = String(s.subtype ?? "").toLowerCase();

  if (
    type === "application" &&
    (subtype === "pdf" || subtype === "octet-stream")
  ) {
    const dispParams = (s.dispositionParameters as Record<string, string>) ?? {};
    const typeParams = (s.parameters as Record<string, string>) ?? {};
    const naam =
      dispParams.filename ??
      typeParams.name ??
      `bijlage-${prefix || "1"}.pdf`;
    if (naam.toLowerCase().endsWith(".pdf")) {
      resultaten.push({ part: prefix || "1", naam });
    }
  }

  if (Array.isArray(s.childNodes)) {
    (s.childNodes as unknown[]).forEach((child, idx) => {
      const childPrefix = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
      resultaten.push(...zoekPdfParts(child, childPrefix));
    });
  }

  return resultaten;
}
