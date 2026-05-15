/**
 * Documenten van de ingelogde medewerker.
 *
 * GET  → lijst van eigen documenten (id, type, status, geupload op)
 *        Bevat GEEN binary; gebruik /document/[id]/inhoud voor de bytes.
 *
 * POST → upload nieuwe foto (multipart form: file + type)
 *        Versleuteld met AES-256-GCM voor opslag in Postgres.
 *        Max grootte: 5 MB rauw input (na client-compressie zou < 2 MB
 *        moeten zijn).
 */
import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { huidigeSessie } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { versleutelBestand } from "@/lib/documenten";

export const dynamic = "force-dynamic";

// Drie verplichte slots — ID-kaart OF paspoort mag voor #1 en #2.
const TOEGESTANE_TYPES = new Set(["id-voor", "id-achter", "bankpas"]);
const TOEGESTANE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/heic", "image/heif",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const sessie = await huidigeSessie();
  if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const rijen = await db.select({
    id: schema.medewerkerDocumenten.id,
    type: schema.medewerkerDocumenten.type,
    mimetype: schema.medewerkerDocumenten.mimetype,
    bestandsnaam: schema.medewerkerDocumenten.bestandsnaam,
    grootteBytes: schema.medewerkerDocumenten.grootteBytes,
    geuploadOp: schema.medewerkerDocumenten.geuploadOp,
    goedgekeurd: schema.medewerkerDocumenten.goedgekeurd,
    goedgekeurdOp: schema.medewerkerDocumenten.goedgekeurdOp,
  })
    .from(schema.medewerkerDocumenten)
    .where(eq(schema.medewerkerDocumenten.medewerkerId, sessie.medewerkerId))
    .orderBy(desc(schema.medewerkerDocumenten.geuploadOp));

  return NextResponse.json({ documenten: rijen });
}

export async function POST(req: Request) {
  try {
    const sessie = await huidigeSessie();
    if (!sessie) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error("[document/POST] formData parse fail:", e);
      return NextResponse.json(
        { error: "Kan formulier-data niet lezen — probeer een kleinere foto" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    const type = formData.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file ontbreekt of niet als File ontvangen" }, { status: 400 });
    }
    if (typeof type !== "string" || !TOEGESTANE_TYPES.has(type)) {
      return NextResponse.json({ error: `type "${type}" ongeldig` }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Bestand is leeg" }, { status: 400 });
    }
    if (!TOEGESTANE_MIMES.has(file.type)) {
      return NextResponse.json(
        { error: `Bestandstype ${file.type || "(onbekend)"} niet ondersteund — gebruik JPEG/PNG/WebP/HEIC` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Bestand te groot (${(file.size / 1024 / 1024).toFixed(1)}MB, max 5MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let versleuteld;
    try {
      versleuteld = versleutelBestand(buffer);
    } catch (e) {
      console.error("[document/POST] encryptie mislukt:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "encryptie mislukt — DOCUMENTEN_ENCRYPTIE_KEY niet gezet?" },
        { status: 500 },
      );
    }

    // Atomair vervangen via een transactie. Zonder tx: als de serverless
    // functie (Vercel) tussen DELETE en INSERT gekilled wordt (maxDuration,
    // OOM), raakt de medewerker z'n oude document kwijt zonder vervanger.
    // Met tx: óf de hele swap slaagt, óf de oude blijft staan.
    const nieuw = await db.transaction(async (tx) => {
      await tx.delete(schema.medewerkerDocumenten).where(and(
        eq(schema.medewerkerDocumenten.medewerkerId, sessie.medewerkerId),
        eq(schema.medewerkerDocumenten.type, type),
      ));
      const [rij] = await tx.insert(schema.medewerkerDocumenten).values({
        medewerkerId: sessie.medewerkerId,
        type,
        mimetype: file.type,
        bestandsnaam: file.name?.slice(0, 200) ?? null,
        iv: versleuteld.iv,
        authtag: versleuteld.authtag,
        ciphertext: versleuteld.ciphertext,
        grootteBytes: buffer.length,
      }).returning({ id: schema.medewerkerDocumenten.id });
      return rij;
    });

    return NextResponse.json({ ok: true, id: nieuw.id });
  } catch (e) {
    console.error("[document/POST] onverwachte fout:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onbekende fout bij upload" },
      { status: 500 },
    );
  }
}
