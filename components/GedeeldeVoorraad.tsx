"use client";

import { useEffect, useState, useCallback } from "react";
import { useRol } from "@/lib/useRol";

type Slug = "bb" | "sl" | "kl";

interface Product {
  id: number;
  naam: string;
  categorie: string | null;
  eenheid: string;
  prijsPerEenheid: number | null;
  actief: boolean;
}

interface AfnameRegel {
  id: number;
  productId: number;
  productNaam: string;
  eenheid: string;
  prijsPerEenheid: number | null;
  voorBedrijf: Slug;
  aantal: number;
  bedrag: number | null;
  datum: string;
  doorMedewerker: string | null;
  notitie: string | null;
}

interface Props {
  bedrijf: Slug;
  hex: string;
}

const BEDRIJF_NAMEN: Record<Slug, string> = {
  bb: "Brunch & Brew",
  sl: "Saté Lounge",
  kl: "Het Kroket Loket",
};

function fmt(n: number): string {
  return "€" + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vandaag(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

export default function GedeeldeVoorraad({ bedrijf, hex }: Props) {
  const { rol } = useRol();
  const isOwner = rol === "owner";

  const [producten, setProducten] = useState<Product[]>([]);
  const [afnames, setAfnames] = useState<AfnameRegel[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  // Form state — log afname
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [aantal, setAantal] = useState("1");
  const [notitie, setNotitie] = useState("");
  const [datum, setDatum] = useState(vandaag());
  const [bezig, setBezig] = useState(false);

  // Owner-only product edit modus
  const [beheerOpen, setBeheerOpen] = useState(false);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const [p, a] = await Promise.all([
        fetch("/api/gedeelde-voorraad/producten", { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/gedeelde-voorraad/afnames?voor=${bedrijf}&limit=30`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setProducten(Array.isArray(p) ? p : []);
      setAfnames(Array.isArray(a) ? a : []);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout bij laden");
    } finally {
      setLaden(false);
    }
  }, [bedrijf]);

  useEffect(() => { laad(); }, [laad]);

  async function logAfname() {
    if (!pickedId || !aantal || Number(aantal) <= 0) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/gedeelde-voorraad/afnames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: pickedId,
          voorBedrijf: bedrijf,
          aantal: Number(aantal.replace(",", ".")),
          datum,
          notitie: notitie.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setPickedId(null);
      setAantal("1");
      setNotitie("");
      await laad();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  async function verwijderAfname(id: number) {
    if (!confirm("Deze afname verwijderen?")) return;
    await fetch(`/api/gedeelde-voorraad/afnames/${id}`, { method: "DELETE" });
    await laad();
  }

  // Groepeer producten per categorie
  const perCategorie = producten.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.categorie ?? "Overig";
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  if (bedrijf === "sl" && !isOwner) {
    return (
      <div className="card">
        <p className="eyebrow mb-1">Gedeelde voorraad</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Dit is de magazijn-vestiging. Andere vestigingen loggen wat ze pakken;
          owner ziet de afrekening in de Salaris-tab.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="eyebrow mb-0.5">Gedeelde voorraad (magazijn SL)</p>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            📦 Wat heb je vandaag gepakt?
          </h3>
        </div>
        {isOwner && (
          <button
            onClick={() => setBeheerOpen((b) => !b)}
            className="text-xs font-medium px-3 py-1.5 rounded text-white"
            style={{ background: hex }}
          >
            {beheerOpen ? "Klaar" : "Beheer producten"}
          </button>
        )}
      </div>

      {fout && <p className="text-[12px] mb-2" style={{ color: "#E5484D" }}>Fout: {fout}</p>}

      {/* Owner-only product-beheer */}
      {isOwner && beheerOpen && (
        <ProductBeheer producten={producten} onWijziging={laad} hex={hex} />
      )}

      {/* Log-form (alle vestigingen behalve SL) */}
      {bedrijf !== "sl" && !beheerOpen && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 mb-3">
          <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Nieuwe afname voor {BEDRIJF_NAMEN[bedrijf]}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px] gap-2 mb-2">
            <select
              value={pickedId ?? ""}
              onChange={(e) => setPickedId(e.target.value ? Number(e.target.value) : null)}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white"
            >
              <option value="">— Kies product —</option>
              {Object.entries(perCategorie).map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.naam} ({p.eenheid}){p.prijsPerEenheid !== null && ` — ${fmt(p.prijsPerEenheid)}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={aantal}
              onChange={(e) => setAantal(e.target.value)}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white"
              placeholder="Aantal"
            />
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white"
            />
          </div>
          <input
            type="text"
            value={notitie}
            onChange={(e) => setNotitie(e.target.value)}
            placeholder="Notitie (optioneel — bv. 'voor weekend-actie')"
            className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white w-full mb-2"
          />
          <button
            onClick={logAfname}
            disabled={bezig || !pickedId || !aantal}
            className="w-full text-sm font-medium px-3 py-2 rounded text-white disabled:opacity-50"
            style={{ background: hex }}
          >
            {bezig ? "Bezig…" : "📥 Loggen"}
          </button>
        </div>
      )}

      {/* Recente afnames */}
      {!beheerOpen && (
        <>
          <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Recent gelogd ({afnames.length})
          </p>
          {laden ? (
            <div className="space-y-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          ) : afnames.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Nog niets gelogd voor deze vestiging.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {afnames.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.aantal}× {a.productNaam}</span>
                      <span className="text-slate-400 text-[11px] ml-1">({a.eenheid})</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {a.datum}{a.doorMedewerker && ` · ${a.doorMedewerker}`}
                      {a.notitie && ` · ${a.notitie}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {a.bedrag === null ? "—" : fmt(a.bedrag)}
                    </p>
                    <button
                      onClick={() => verwijderAfname(a.id)}
                      className="text-[10px] text-slate-400 hover:text-red-500"
                    >
                      verwijder
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ─── Owner-only sub-component voor product-beheer ────────────────────────────

interface ProductBeheerProps {
  producten: Product[];
  onWijziging: () => void;
  hex: string;
}

function ProductBeheer({ producten, onWijziging, hex }: ProductBeheerProps) {
  const [naam, setNaam] = useState("");
  const [eenheid, setEenheid] = useState("stuk");
  const [prijs, setPrijs] = useState("");
  const [categorie, setCategorie] = useState("");
  const [bezig, setBezig] = useState(false);

  async function toevoegen() {
    if (!naam.trim()) return;
    setBezig(true);
    try {
      await fetch("/api/gedeelde-voorraad/producten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: naam.trim(),
          eenheid: eenheid.trim() || "stuk",
          prijsPerEenheid: prijs.trim() ? Number(prijs.replace(",", ".")) : null,
          categorie: categorie.trim() || null,
        }),
      });
      setNaam(""); setPrijs(""); setCategorie("");
      onWijziging();
    } finally {
      setBezig(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    await fetch(`/api/gedeelde-voorraad/producten/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onWijziging();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 mb-3 space-y-3">
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Nieuwe product
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_100px] gap-2">
        <input
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Naam (bv. Cola 24×33cl)"
          className="text-sm border border-slate-200 rounded px-2 py-1.5"
        />
        <input
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
          placeholder="Categorie"
          className="text-sm border border-slate-200 rounded px-2 py-1.5"
        />
        <input
          value={eenheid}
          onChange={(e) => setEenheid(e.target.value)}
          placeholder="Eenheid"
          className="text-sm border border-slate-200 rounded px-2 py-1.5"
        />
        <input
          value={prijs}
          onChange={(e) => setPrijs(e.target.value)}
          placeholder="Prijs €"
          inputMode="decimal"
          className="text-sm border border-slate-200 rounded px-2 py-1.5 tabular-nums"
        />
      </div>
      <button
        onClick={toevoegen}
        disabled={bezig || !naam.trim()}
        className="text-sm font-medium px-3 py-1.5 rounded text-white disabled:opacity-50"
        style={{ background: hex }}
      >
        + Toevoegen
      </button>

      <p className="text-[11px] uppercase tracking-wide pt-2 border-t border-slate-100" style={{ color: "var(--muted)" }}>
        Bestaande producten ({producten.length})
      </p>
      <div className="space-y-1">
        {producten.map((p) => (
          <ProductRij key={p.id} product={p} onPatch={(body) => patch(p.id, body)} />
        ))}
      </div>
    </div>
  );
}

function ProductRij({ product, onPatch }: { product: Product; onPatch: (body: Record<string, unknown>) => Promise<void> }) {
  const [prijs, setPrijs] = useState(product.prijsPerEenheid !== null ? String(product.prijsPerEenheid) : "");
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1 truncate">
        <span className="font-medium">{product.naam}</span>
        {product.categorie && <span className="text-slate-400 text-[11px] ml-2">{product.categorie}</span>}
        <span className="text-slate-400 text-[11px] ml-2">{product.eenheid}</span>
      </span>
      <input
        value={prijs}
        onChange={(e) => { setPrijs(e.target.value); setDirty(true); }}
        placeholder="€"
        inputMode="decimal"
        className="w-20 text-sm border border-slate-200 rounded px-2 py-1 text-right tabular-nums"
      />
      {dirty && (
        <button
          onClick={async () => {
            await onPatch({ prijsPerEenheid: prijs.trim() ? Number(prijs.replace(",", ".")) : null });
            setDirty(false);
          }}
          className="text-[11px] font-medium text-blue-600"
        >
          Opslaan
        </button>
      )}
      <button
        onClick={() => onPatch({ actief: false })}
        className="text-[11px] text-slate-400 hover:text-red-500 px-1"
        title="Verwijderen"
      >
        ✕
      </button>
    </div>
  );
}
