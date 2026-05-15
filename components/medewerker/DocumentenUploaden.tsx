"use client";

/**
 * Documenten-upload sectie voor /m/profiel. Drie verplichte slots:
 * 1. ID-kaart of paspoort voorkant
 * 2. ID-kaart of paspoort achterkant
 * 3. Bankpas voorkant (IBAN moet zichtbaar zijn)
 *
 * Compressie client-side via canvas — foto's van een iPhone zijn vaak
 * 3-5 MB; we resizen naar max 1600px breed en compressen JPEG q=0.85 zodat
 * de upload < 1 MB blijft. HEIC kan niet door canvas — dan sturen we 'm
 * onbewerkt (server slikt 'm tot 5 MB).
 *
 * Geeft via onCompletheid door of alle 3 slots gevuld zijn — parent
 * blokkeert daarop de "Opslaan & naar portaal" knop.
 */
import { useCallback, useEffect, useState } from "react";

type DocType = "id-voor" | "id-achter" | "bankpas";

interface DocRij {
  id: number;
  type: string;
  mimetype: string;
  grootteBytes: number;
  geuploadOp: string;
  goedgekeurd: boolean;
}

interface Props {
  onCompletheid?: (compleet: boolean) => void;
}

const TYPE_LABELS: Record<DocType, { nummer: number; titel: string; hint: string }> = {
  "id-voor":   { nummer: 1, titel: "ID-kaart of paspoort — voorkant", hint: "Foto-pagina met je naam en geboortedatum" },
  "id-achter": { nummer: 2, titel: "ID-kaart of paspoort — achterkant", hint: "Voor BSN-verificatie (bij paspoort: de pagina met de chip-code)" },
  "bankpas":   { nummer: 3, titel: "Bankpas voorkant", hint: "IBAN en je naam moeten zichtbaar zijn" },
};

const ALLE_TYPES: DocType[] = ["id-voor", "id-achter", "bankpas"];

async function compresseerFoto(file: File, maxBreedte = 1600, kwaliteit = 0.85): Promise<Blob> {
  // HEIC en andere niet-canvas-decodeerbare formaten: serve as-is en laat
  // server beslissen of 't door de mime/size-checks komt.
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }
  try {
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
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", kwaliteit);
    });
  } catch {
    // createImageBitmap kan falen op exotische formaten — fall through
    return file;
  }
}

export default function DocumentenUploaden({ onCompletheid }: Props) {
  const [docs, setDocs] = useState<DocRij[]>([]);
  const [bezig, setBezig] = useState<DocType | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const laad = useCallback(async () => {
    const res = await fetch("/api/medewerker/document", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json() as { documenten: DocRij[] };
      setDocs(j.documenten);
    }
  }, []);

  useEffect(() => { laad(); }, [laad]);

  // Notify parent over completheid (alle 3 slots gevuld?)
  useEffect(() => {
    const compleet = ALLE_TYPES.every((t) => docs.some((d) => d.type === t));
    onCompletheid?.(compleet);
  }, [docs, onCompletheid]);

  async function upload(type: DocType, file: File) {
    setBezig(type);
    setFout(null);
    try {
      const blob = await compresseerFoto(file);
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error("Foto is groter dan 5MB. Probeer een kleinere foto of foto opnieuw nemen.");
      }
      const formData = new FormData();
      // Gebruik .jpg extensie als de compressie 'm naar jpeg heeft omgezet,
      // anders origineel
      const naam = file.name?.replace(/\.[^.]+$/, "") || "foto";
      const finalNaam = blob.type === "image/jpeg" ? `${naam}.jpg` : file.name || "foto";
      formData.append("file", blob, finalNaam);
      formData.append("type", type);

      const res = await fetch("/api/medewerker/document", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j.error || `Upload mislukt (status ${res.status})`);
      }
      await laad();
    } catch (e) {
      const bericht = e instanceof Error ? e.message : "onbekende fout";
      console.error("[DocumentenUploaden] upload mislukt:", e);
      setFout(bericht);
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
      <div key={type} className="rounded-xl p-3" style={{ background: doc ? "var(--bg-elev)" : "var(--bg)", border: doc ? "1px solid #30B26F" : "1px dashed var(--hairline)" }}>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
            <span className="inline-block w-5 h-5 rounded-full text-[11px] text-center leading-5 mr-1.5"
                  style={{ background: doc ? "#30B26F" : "var(--bg-elev)", color: doc ? "#fff" : "var(--muted)" }}>
              {doc ? "✓" : info.nummer}
            </span>
            {info.titel}
          </p>
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
        <p className="text-[11px] mb-2 ml-7" style={{ color: "var(--muted)" }}>{info.hint}</p>

        {doc ? (
          <div className="flex items-center gap-2 ml-7">
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
                Opnieuw
              </button>
            )}
            <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>
              {(doc.grootteBytes / 1024).toFixed(0)} KB
            </span>
          </div>
        ) : (
          <label className="block ml-7">
            <input
              type="file"
              accept="image/*"
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

  const gevuld = ALLE_TYPES.filter((t) => docs.some((d) => d.type === t)).length;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[12px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Identiteit & bankpas — verplicht
        </h2>
        <span className="text-[11px]" style={{ color: gevuld === 3 ? "#30B26F" : "var(--muted)" }}>
          {gevuld}/3 geüpload
        </span>
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
        Foto's worden AES-256 versleuteld opgeslagen. Alleen de eigenaar
        kan ze inzien voor de loonadministratie.
      </p>
      <div className="space-y-2">
        {ALLE_TYPES.map(renderSlot)}
      </div>
      {fout && (
        <p className="text-[12px] mt-2 px-3 py-2 rounded-md" style={{ background: "#FFEEED", color: "#B91C1C" }}>
          ✗ {fout}
        </p>
      )}
    </div>
  );
}
