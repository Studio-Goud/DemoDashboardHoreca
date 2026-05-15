/**
 * Owner-pagina: dagelijkse QR-code printen.
 *
 * Toont een QR voor vandaag (default) of een gekozen datum, plus de URL
 * en een print-knop. Hang aan tafel of plak op de bon. QR-code is 2
 * dagen geldig na de bedoelde datum (zie /api/feedback validatie).
 */
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db, schema } from "@/lib/db/client";
import { huidigeAdminSessie } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import PrintKnop from "@/components/PrintKnop";

interface Props {
  params: { bedrijf: string };
  searchParams: { d?: string };
}

export const dynamic = "force-dynamic";

export default async function QrPage({ params, searchParams }: Props) {
  const sessie = huidigeAdminSessie();
  if (!sessie || (sessie.rol !== "owner" && sessie.rol !== "manager")) {
    redirect("/login");
  }

  const dept = await db.select().from(schema.departments).where(eq(schema.departments.slug, params.bedrijf)).limit(1);
  if (dept.length === 0) notFound();
  const bedrijf = dept[0];

  const vandaag = new Date().toISOString().slice(0, 10);
  const datum = searchParams.d && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d) ? searchParams.d : vandaag;

  const host = headers().get("x-forwarded-host") ?? headers().get("host") ?? "localhost:3000";
  const proto = headers().get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/feedback/${params.bedrijf}?d=${datum}`;

  // Inline SVG zodat het direct printbaar is — geen externe afhankelijkheid.
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    width: 480,
  });

  return (
    <main className="min-h-screen p-6" style={{ background: "var(--bg, #08090C)" }}>
      <div className="max-w-md mx-auto">
        <a
          href={`/${params.bedrijf}`}
          className="font-mono text-[10px] tracking-[0.18em] uppercase mb-4 inline-block"
          style={{ color: "var(--muted)" }}
        >
          ← Terug naar dashboard
        </a>

        <div className="text-center mb-6">
          <p
            className="font-mono text-[10px] tracking-[0.32em] uppercase mb-2"
            style={{ color: bedrijf.hex }}
          >
            Feedback QR
          </p>
          <h1
            className="font-display text-[24px] font-semibold tracking-tight mb-1"
            style={{ color: "var(--text, #E8ECF4)" }}
          >
            {bedrijf.naam}
          </h1>
          <p className="text-[12px]" style={{ color: "var(--muted, #8A8F9C)" }}>
            {datum}
          </p>
        </div>

        <div
          id="print-area"
          className="bg-white p-6 rounded-2xl text-center"
          style={{ color: "#000" }}
        >
          <p className="font-mono text-[10px] tracking-[0.32em] uppercase mb-2" style={{ color: "#555" }}>
            Hoe was je bezoek?
          </p>
          <h2 className="font-display text-[20px] font-bold mb-4">{bedrijf.naam}</h2>
          <div
            className="mx-auto mb-3"
            style={{ width: 280, height: 280 }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="font-mono text-[10px]" style={{ color: "#666" }}>
            Scan en geef ons een sterren-beoordeling. Bedankt!
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <p className="font-mono text-[10px] break-all" style={{ color: "var(--muted)" }}>
            {url}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/${params.bedrijf}/qr?d=${nieuweDatum(datum, -1)}`}
              className="text-center py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-wider"
              style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", color: "var(--text)" }}
            >
              ← gisteren
            </a>
            <a
              href={`/${params.bedrijf}/qr?d=${nieuweDatum(datum, 1)}`}
              className="text-center py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-wider"
              style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", color: "var(--text)" }}
            >
              morgen →
            </a>
          </div>
          <PrintKnop hex={bedrijf.hex} />
        </div>
      </div>
    </main>
  );
}

function nieuweDatum(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
