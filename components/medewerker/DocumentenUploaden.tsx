"use client";

/**
 * Documenten-upload sectie voor /m/profiel. Per type één slot:
 * - id-voor + id-achter (samen één ID-kaart) OF
 * - paspoort (alternatief, 1 foto volstaat)
 * - bankpas (matchen IBAN)
 *
 * Compressie client-side via canvas — foto's van een iPhone zijn vaak
 * 3-5 MB; we resizen naar max 1600px breed en compressen JPEG q=0.85 zodat
 * de upload < 1 MB blijft. ID-foto's blijven goed leesbaar bij die schaal.
 */
import { useEffect, useState } from "react";

type DocType = "id-voor" | "id-achter" | "paspoort" | "bankpas";

interface DocRij {
  id: number;
  type: string;
  mimetype: string;
  grootteBytes: number;
  geuploadOp: string;
  goedgekeurd: boolean;
}

const TYPE_LABELS: Record<DocType, { titel: string; hint: string }> = {
  "id-voor":   { titel: "ID-kaart voorkant",  hint: "Duidelijk leesbaar, alle hoeken zichtbaar" },
  "id-achter": { titel: "ID-kaart achterkant", hint: "Voor adres + BSN-verificatie" },
  "paspoort":  { titel: "Paspoort",            hint: "Alternatief — als je geen ID-kaart hebt" },
  "bankpas":   { titel: "Bankpas",             hint: "IBAN moet zichtbaar zijn, naam ook" },
};

async function compresseerFoto(file: File, maxBreedte = 1600, kwaliteit = 0.85): Promise<Blob> {
  // HEIC en exotic formaten kunnen we niet via canvas decoderen — laat door
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const schaal = bitmap.width > maxBreedte ? maxBreedte / bitmap.width : 1;
  const breedte = Math.round(bitmap.width * schaal);
  const hoogte = Math.round(bitmap.height * schaal);
  const canvas = document.createElement("canvas");
  canvas.width = breedte;
  canvas.height = hoogte;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, breedte, hoogte);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", kwaliteit);
  });
}

export default function DocumentenUploaden() {
  const [docs, setDocs] = useState<DocRij[]>([]);
  const [bezig, setBezig] = useState<DocType | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function laad() {
    const res = await fetch("/api/medewerker/document", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json() as { documenten: DocRij[] };
      setDocs(j.documenten);
    }
  }
  useEffect(() => { laad(); }, []);

  async function upload(type: DocType, file: File) {
    setBezig(type);
    setFout(null);
    try {
      const blob = await compresseerFoto(file);
      const formData = new FormData();
      formData.append("file", blob, file.name);
      formData.append("type", type);

      const res = await fetch("/api/medewerker/document", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "upload mislukt");
      }
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(null);
    }
  }

  async function verwijder(id: number) {
    if (!confirm("Document verwijderen?")) return;
    const res = await fetch(`/api/medewerker/document/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "fout" }));
      setFout(j.error || "verwijderen mislukt");
      return;
    }
    await laad();
  }

  function docVoorType(type: DocType): DocRij | undefined {
    return docs.find((d) => d.type === type);
  }

  function renderSlot(type: DocType) {
    const info = TYPE_LABELS[type];
    const doc = docVoorType(type);
    const isBezig = bezig === type;

    return (
      <div key={type} className="rounded-xl p-3" style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{info.titel}</p>
          {doc?.goedgekeurd && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#30B26F", color: "#fff" }}>
              ✓ Goedgekeurd
            </span>
          )}
          {doc && !doc.goedgekeurd && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#F0B731", color: "#fff" }}>
              In review
            </span>
          )}
        </div>
        <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>{info.hint}</p>

        {doc ? (
          <div className="flex items-center gap-2">
            <a
              href={`/api/medewerker/document/${doc.id}/inhoud`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] px-3 py-1.5 rounded-md"
              style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            >
              👁 Bekijken
            </a>
            {!doc.goedgekeurd && (
              <button
                onClick={() => verwijder(doc.id)}
                className="text-[12px] px-3 py-1.5 rounded-md"
                style={{ background: "var(--bg)", border: "1px solid var(--hairline)", color: "#E5484D" }}
              >
                Verwijderen
              </button>
            )}
            <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>
              {(doc.grootteBytes / 1024).toFixed(0)} KB
            </span>
          </div>
        ) : (
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              className="hidden"
              disabled={isBezig}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(type, f);
                e.target.value = "";
              }}
            />
            <span
              className="inline-block text-[12px] px-3 py-1.5 rounded-md cursor-pointer text-white"
              style={{ background: isBezig ? "#94A3B8" : "#0A84FF" }}
            >
              {isBezig ? "Uploaden…" : "📷 Foto kiezen"}
            </span>
          </label>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
        Identiteit & bankpas
      </h2>
      <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
        Foto's worden AES-256 versleuteld opgeslagen. Alleen de eigenaar
        kan ze inzien voor de loonadministratie. Upload ID-kaart (voor +
        achter) <em>of</em> paspoort, plus je bankpas.
      </p>
      <div className="space-y-2">
        {(["id-voor", "id-achter", "paspoort", "bankpas"] as DocType[]).map(renderSlot)}
      </div>
      {fout && (
        <p className="text-[12px] mt-2" style={{ color: "#E5484D" }}>{fout}</p>
      )}
    </div>
  );
}
