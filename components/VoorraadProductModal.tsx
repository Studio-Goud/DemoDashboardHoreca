"use client";

import { useState } from "react";
import Icon from "./Icon";
import type { Product } from "./VoorraadBeheer";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
  product: Product | null;     // null = nieuw
  onSluit: () => void;
  onKlaar: () => void;
}

const EENHEDEN = ["stuk", "doos", "pak", "fles", "zak", "rol", "kg", "liter"];

export default function VoorraadProductModal({ bedrijf, hex, product, onSluit, onKlaar }: Props) {
  const isNieuw = product === null;

  const [naam,            setNaam]           = useState(product?.naam ?? "");
  const [eenheid,         setEenheid]        = useState(product?.eenheid ?? "stuk");
  const [categorie,       setCategorie]      = useState(product?.categorie ?? "");
  const [drempelLaag,     setDrempelLaag]    = useState(String(product?.drempelLaag ?? 3));
  const [drempelKritiek,  setDrempelKritiek] = useState(String(product?.drempelKritiek ?? 1));
  const [kritiekProduct,  setKritiekProduct] = useState(product?.kritiekProduct ?? false);
  const [notitie,         setNotitie]        = useState(product?.notitie ?? "");
  const [busy,            setBusy]           = useState(false);
  const [fout,            setFout]           = useState<string | null>(null);

  async function opslaan() {
    setBusy(true);
    setFout(null);
    try {
      const body = {
        naam: naam.trim(),
        eenheid,
        categorie: categorie.trim() || null,
        drempelLaag:    Math.max(0, Number(drempelLaag) || 0),
        drempelKritiek: Math.max(0, Number(drempelKritiek) || 0),
        kritiekProduct,
        notitie: notitie.trim() || null,
      };
      if (!body.naam) {
        setFout("Naam is verplicht");
        return;
      }
      if (body.drempelKritiek > body.drempelLaag) {
        setFout("Drempel 'kritiek' moet lager of gelijk zijn aan 'laag'");
        return;
      }

      const url = isNieuw ? `/api/voorraad/${bedrijf}` : `/api/voorraad/producten/${product!.id}`;
      const method = isNieuw ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "opslaan mislukt");
      }
      onKlaar();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  async function verwijderen() {
    if (!product) return;
    if (!confirm(`"${product.naam}" verwijderen uit voorraad?\n\nDit is een soft-delete — de historie blijft bewaard.`))
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/voorraad/producten/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "verwijderen mislukt");
      }
      onKlaar();
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onSluit}
    >
      <div
        className="card max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-elev)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="shopping-bag" size={18} className="opacity-70" />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
              {isNieuw ? "Nieuw product" : "Product bewerken"}
            </h2>
          </div>
          <button onClick={onSluit} className="text-[20px]" style={{ color: "var(--muted)" }}>×</button>
        </div>

        <div className="space-y-3">
          <Veld label="Productnaam">
            <input
              type="text"
              value={naam}
              autoFocus
              onChange={(e) => setNaam(e.target.value)}
              className="inputveld"
              placeholder="bv. Koffiebonen 1kg"
            />
          </Veld>

          <div className="grid grid-cols-2 gap-3">
            <Veld label="Eenheid">
              <select
                value={eenheid}
                onChange={(e) => setEenheid(e.target.value)}
                className="inputveld"
              >
                {EENHEDEN.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Veld>
            <Veld label="Categorie">
              <input
                type="text"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="inputveld"
                placeholder="bv. Koffie · Bekers"
              />
            </Veld>
          </div>

          <div className="p-3 rounded-[10px]" style={{ background: "var(--bg)", border: "1px solid var(--hairline)" }}>
            <p className="eyebrow mb-2">Meldingen — wanneer waarschuwen?</p>
            <div className="grid grid-cols-2 gap-3">
              <Veld label="Bestel binnenkort bij ≤">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={drempelLaag}
                  onChange={(e) => setDrempelLaag(e.target.value)}
                  className="inputveld"
                />
              </Veld>
              <Veld label="DIRECT bestellen bij ≤">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={drempelKritiek}
                  onChange={(e) => setDrempelKritiek(e.target.value)}
                  className="inputveld"
                />
              </Veld>
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
              Bv. <strong>≤3</strong> voor &quot;Laag&quot; en <strong>≤1</strong> voor &quot;Kritiek&quot;. Bij Kritiek komt het product
              in de rode bestellijst bovenaan.
            </p>
          </div>

          <label
            className="flex items-start gap-2 cursor-pointer p-3 rounded-[10px]"
            style={{
              background: kritiekProduct ? "rgba(229,72,77,0.06)" : "var(--bg)",
              border: `1px solid ${kritiekProduct ? "rgba(229,72,77,0.3)" : "var(--hairline)"}`,
            }}
          >
            <input
              type="checkbox"
              checked={kritiekProduct}
              onChange={(e) => setKritiekProduct(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="text-[13px] font-medium block" style={{ color: "var(--text)" }}>
                ⚡ Kritiek product — bar dicht zonder dit
              </span>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                Bv. bekers, koffiebonen. Toont met breathing rode highlight bovenaan zodra het kritiek wordt.
              </span>
            </span>
          </label>

          <Veld label="Notitie (optioneel)">
            <input
              type="text"
              value={notitie}
              onChange={(e) => setNotitie(e.target.value)}
              className="inputveld"
              placeholder="bv. leverancier, bestelnummer, artikelcode"
            />
          </Veld>

          {fout && (
            <p className="text-[12px]" style={{ color: "#E5484D" }}>{fout}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-5 pt-3 hairline">
          {!isNieuw ? (
            <button
              onClick={verwijderen}
              disabled={busy}
              className="text-[13px] font-medium disabled:opacity-50"
              style={{ color: "#E5484D" }}
            >
              Verwijderen
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onSluit}
              className="px-3 py-1.5 text-[13px] font-medium"
              style={{ color: "var(--text-2)" }}
            >
              Annuleer
            </button>
            <button
              onClick={opslaan}
              disabled={busy || !naam.trim()}
              className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: hex }}
            >
              {busy ? "Bezig…" : "Opslaan"}
            </button>
          </div>
        </div>

        <style jsx>{`
          .inputveld {
            width: 100%;
            padding: 8px 10px;
            border-radius: 8px;
            background: var(--bg);
            border: 1px solid var(--hairline);
            color: var(--text);
            font-size: 13px;
            font-family: inherit;
          }
          .inputveld:focus { outline: none; border-color: ${hex}; }
        `}</style>
      </div>
    </div>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow block mb-1">{label}</label>
      {children}
    </div>
  );
}
