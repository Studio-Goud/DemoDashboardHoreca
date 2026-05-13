"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "./Icon";
import VoorraadProductModal from "./VoorraadProductModal";

type Niveau = "vol" | "laag" | "kritiek" | "op";

export interface Product {
  id: string;
  naam: string;
  eenheid: string;
  categorie: string | null;
  drempelKritiek: number;
  drempelLaag: number;
  kritiekProduct: boolean;
  notitie: string | null;
  volgorde: number;
  aantal: number;
  niveau: Niveau;
  laatsteUpdate: string | null;
  laatsteUpdateDoor: string | null;
}

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  naam: string;
  hex: string;
  initieleProducten: Product[];
}

const NIVEAU_KLEUR: Record<Niveau, string> = {
  op:      "#E5484D",
  kritiek: "#E5484D",
  laag:    "#E07A1F",
  vol:     "#30B26F",
};

const NIVEAU_LABEL: Record<Niveau, string> = {
  op:      "Op",
  kritiek: "Kritiek",
  laag:    "Laag",
  vol:     "Op voorraad",
};

function fmtTijdGeleden(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "zojuist";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min geleden`;
  const uur = Math.floor(min / 60);
  if (uur < 24) return `${uur}u geleden`;
  const dag = Math.floor(uur / 24);
  return `${dag}d geleden`;
}

export default function VoorraadBeheer({ bedrijf, naam, hex, initieleProducten }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [producten, setProducten] = useState<Product[]>(initieleProducten);
  const [busy, setBusy] = useState<string | null>(null);
  const [modalProduct, setModalProduct] = useState<Product | "nieuw" | null>(null);

  // Polling — elke 30s nieuwe data ophalen voor live-feel
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/voorraad/${bedrijf}`, { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { producten: Product[] };
        setProducten(j.producten);
      }
    } catch {
      // stil
    }
  }, [bedrijf]);

  useEffect(() => {
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function setAantal(productId: string, aantal: number) {
    if (aantal < 0) return;
    setBusy(productId);
    // Optimistische update
    setProducten((p) => p.map((x) => {
      if (x.id !== productId) return x;
      const niveau: Niveau = aantal <= 0 ? "op"
        : aantal <= x.drempelKritiek ? "kritiek"
        : aantal <= x.drempelLaag ? "laag"
        : "vol";
      return { ...x, aantal, niveau, laatsteUpdate: new Date().toISOString() };
    }));
    try {
      await fetch(`/api/voorraad/status/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aantal }),
      });
      // Refresh om "laatste update door" name op te halen
      setTimeout(refresh, 300);
    } finally {
      setBusy(null);
    }
  }

  // Groepeer per categorie
  const perCategorie = new Map<string, Product[]>();
  for (const p of producten) {
    const cat = p.categorie || "Overig";
    const lijst = perCategorie.get(cat) ?? [];
    lijst.push(p);
    perCategorie.set(cat, lijst);
  }
  const categorieen = Array.from(perCategorie.keys()).sort();

  // Bestellijst: alle niet-vol
  const teBestellen = producten.filter((p) => p.niveau !== "vol")
    .sort((a, b) => {
      // Kritiek-product + "op" eerst
      const priorA = (a.niveau === "op" ? 0 : a.niveau === "kritiek" ? 1 : 2) - (a.kritiekProduct ? 0.5 : 0);
      const priorB = (b.niveau === "op" ? 0 : b.niveau === "kritiek" ? 1 : 2) - (b.kritiekProduct ? 0.5 : 0);
      return priorA - priorB;
    });
  const kritiekeAlerts = teBestellen.filter((p) => p.kritiekProduct && (p.niveau === "kritiek" || p.niveau === "op"));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/${bedrijf}`} className="text-[12px] flex items-center gap-1" style={{ color: "var(--muted)" }}>
            <Icon name="chevron-right" size={14} className="rotate-180" />
            Terug
          </Link>
          <div>
            <p className="eyebrow">Voorraad · {naam}</p>
            <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>
              {producten.length} producten · {teBestellen.length} te bestellen
            </h1>
          </div>
        </div>
        <button
          onClick={() => setModalProduct("nieuw")}
          className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium text-white"
          style={{ background: hex }}
        >
          + Product toevoegen
        </button>
      </div>

      {/* Kritieke alerts (BIJ DE KOFFIEBAR... zonder bekers geen koffie) */}
      {kritiekeAlerts.length > 0 && (
        <div
          className="card breathe-critical"
          style={{
            color: "#E5484D",
            background: "rgba(229,72,77,0.06)",
            borderColor: "rgba(229,72,77,0.4)",
          }}
        >
          <div className="flex items-center gap-2 mb-2" style={{ color: "#E5484D" }}>
            <Icon name="alert" size={18} />
            <h2 className="text-[13px] font-semibold tracking-wide">DIRECT BESTELLEN — kritieke producten</h2>
          </div>
          <ul className="space-y-1.5">
            {kritiekeAlerts.map((p) => (
              <li key={p.id} className="text-[14px] font-medium" style={{ color: "var(--text)" }}>
                <span style={{ color: "#E5484D" }}>● </span>
                <strong>{p.naam}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {" "}— nog {p.aantal} {p.eenheid}{p.aantal !== 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bestellijst (alle laag/kritiek/op) */}
      {teBestellen.length > 0 && (
        <div className="card" style={{ borderColor: `${hex}33` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="shopping-bag" size={16} className="opacity-70" />
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
                Bestellijst
              </h2>
            </div>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              Live · ververst elke 30s
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {teBestellen.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-[8px]"
                style={{
                  background: p.niveau === "op" || p.niveau === "kritiek" ? "rgba(229,72,77,0.08)" : "rgba(224,122,31,0.08)",
                }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: NIVEAU_KLEUR[p.niveau],
                      color: NIVEAU_KLEUR[p.niveau],
                    }}
                  />
                  <span className="text-[12.5px] truncate" style={{ color: "var(--text)" }}>
                    {p.kritiekProduct && "⚡ "}{p.naam}
                  </span>
                </span>
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--muted)" }}>
                  {p.aantal} {p.eenheid}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volledige productlijst per categorie */}
      {producten.length === 0 ? (
        <div className="card text-center py-10">
          <Icon name="shopping-bag" size={32} className="mx-auto opacity-30 mb-2" />
          <p className="text-[14px] mb-1" style={{ color: "var(--muted)" }}>Nog geen producten</p>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>
            Klik bovenaan op &quot;+ Product toevoegen&quot; om te beginnen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {categorieen.map((cat) => (
            <div key={cat} className="card p-0 overflow-hidden">
              <p className="eyebrow px-4 pt-3 pb-2">{cat}</p>
              <div>
                {perCategorie.get(cat)!.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{
                      borderTop: i > 0 ? "1px solid var(--hairline-2)" : "none",
                      background:
                        p.niveau === "op" || p.niveau === "kritiek" ? "rgba(229,72,77,0.04)"
                        : p.niveau === "laag" ? "rgba(224,122,31,0.03)"
                        : "transparent",
                    }}
                  >
                    {/* Niveau indicator */}
                    <span
                      className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                        p.kritiekProduct && p.niveau !== "vol" ? "glow-pulse" : ""
                      }`}
                      style={{
                        background: NIVEAU_KLEUR[p.niveau],
                        color: NIVEAU_KLEUR[p.niveau],
                      }}
                      title={NIVEAU_LABEL[p.niveau]}
                    />

                    {/* Naam + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                        {p.kritiekProduct && (
                          <span title="Kritiek product — zonder dit gaat de bar dicht" style={{ color: "#E5484D" }}>
                            ⚡
                          </span>
                        )}
                        {p.naam}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        <span style={{ color: NIVEAU_KLEUR[p.niveau], fontWeight: 500 }}>
                          {NIVEAU_LABEL[p.niveau]}
                        </span>
                        {" "}· laag bij ≤{p.drempelLaag} · kritiek bij ≤{p.drempelKritiek}
                        {p.laatsteUpdateDoor && (
                          <> · {fmtTijdGeleden(p.laatsteUpdate)} door {p.laatsteUpdateDoor}</>
                        )}
                      </p>
                    </div>

                    {/* Aantal-stepper */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setAantal(p.id, Math.max(0, p.aantal - 1))}
                        disabled={busy === p.id || p.aantal <= 0}
                        className="w-8 h-8 rounded-[8px] text-[16px] font-semibold disabled:opacity-30 transition-colors"
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--hairline)",
                          color: "var(--text)",
                        }}
                        aria-label="Minder"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={p.aantal}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n)) setAantal(p.id, Math.max(0, n));
                        }}
                        className="w-14 h-8 rounded-[8px] text-center text-[14px] font-semibold tabular-nums"
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--hairline)",
                          color: "var(--text)",
                        }}
                      />
                      <button
                        onClick={() => setAantal(p.id, p.aantal + 1)}
                        disabled={busy === p.id}
                        className="w-8 h-8 rounded-[8px] text-[16px] font-semibold disabled:opacity-30 transition-colors"
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--hairline)",
                          color: "var(--text)",
                        }}
                        aria-label="Meer"
                      >
                        +
                      </button>
                      <span className="text-[11px] ml-1.5" style={{ color: "var(--muted)" }}>
                        {p.eenheid}
                      </span>
                    </div>

                    <button
                      onClick={() => setModalProduct(p)}
                      className="text-[12px] px-2 py-1 rounded-md ml-1"
                      style={{ color: hex }}
                    >
                      Bewerken
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalProduct && (
        <VoorraadProductModal
          bedrijf={bedrijf}
          hex={hex}
          product={modalProduct === "nieuw" ? null : modalProduct}
          onSluit={() => setModalProduct(null)}
          onKlaar={() => {
            setModalProduct(null);
            refresh();
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
