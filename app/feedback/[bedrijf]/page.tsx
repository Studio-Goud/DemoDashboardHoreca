/**
 * Publieke feedback-pagina — klant scant QR aan tafel/op de bon,
 * landt hier. URL: /feedback/[bedrijf]?d=YYYY-MM-DD
 *
 * QR-code wordt dagelijks gegenereerd door de owner (zie /[bedrijf]/qr).
 * Datum-param wordt server-side gevalideerd op max 2 dagen oud zodat een
 * gephotographeerde QR niet weken later opnieuw gebruikt kan worden.
 */
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import FeedbackForm from "@/components/FeedbackForm";

interface Props {
  params: { bedrijf: string };
  searchParams: { d?: string };
}

export const dynamic = "force-dynamic";

const GOOGLE_PLACE_URLS: Record<string, string> = {
  // Owner kan deze later invullen — leeg = geen Google-passthrough knop.
  bb: "",
  sl: "",
  kl: "",
};

export default async function FeedbackPage({ params, searchParams }: Props) {
  const bedrijfSlug = params.bedrijf;
  const dept = await db.select().from(schema.departments).where(eq(schema.departments.slug, bedrijfSlug)).limit(1);
  if (dept.length === 0) notFound();
  const bedrijf = dept[0];

  // Valideer datum — als geen of ongeldig, fallback naar vandaag
  const vandaag = new Date().toISOString().slice(0, 10);
  const datum = searchParams.d && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d)
    ? searchParams.d
    : vandaag;

  const googleUrl = GOOGLE_PLACE_URLS[bedrijfSlug] || "";

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg, #08090C)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p
            className="font-mono text-[10px] tracking-[0.32em] uppercase mb-3"
            style={{ color: bedrijf.hex }}
          >
            Feedback
          </p>
          <h1
            className="font-display text-[28px] font-semibold tracking-tight mb-2"
            style={{ color: "var(--text, #E8ECF4)" }}
          >
            Hoe was je bezoek?
          </h1>
          <p className="text-[14px]" style={{ color: "var(--muted, #8A8F9C)" }}>
            {bedrijf.naam}
          </p>
        </div>

        <FeedbackForm
          bedrijfSlug={bedrijfSlug}
          bedrijfNaam={bedrijf.naam}
          datum={datum}
          hex={bedrijf.hex}
          googleUrl={googleUrl}
        />
      </div>
    </main>
  );
}
