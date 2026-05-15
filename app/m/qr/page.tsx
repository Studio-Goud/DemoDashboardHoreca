/**
 * Medewerker-eigen QR-pagina. Toont vandaag's persoonlijke QR (HMAC-
 * geverifieerd, vervalt morgenochtend). Klant scant, landt op
 * /r/{token}, klikt door naar Google/TripAdvisor — medewerker ziet via
 * polling realtime een +1 op haar telefoon.
 */
import { headers } from "next/headers";
import QRCode from "qrcode";
import { vereistGoedgekeurdeMedewerker } from "@/lib/medewerker-gate";
import { maakReviewToken, vandaagIso } from "@/lib/review-token";
import MijnQRWidget from "@/components/MijnQRWidget";

export const dynamic = "force-dynamic";

export default async function MijnQrPage() {
  const sessie = await vereistGoedgekeurdeMedewerker();
  const datum = vandaagIso();
  const token = maakReviewToken(sessie.medewerkerId, datum);

  const host = headers().get("x-forwarded-host") ?? headers().get("host") ?? "localhost:3000";
  const proto = headers().get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/r/${token}`;

  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    width: 360,
  });

  return (
    <MijnQRWidget
      voornaam={sessie.naam.split(" ")[0]}
      datum={datum}
      url={url}
      qrSvg={qrSvg}
    />
  );
}
