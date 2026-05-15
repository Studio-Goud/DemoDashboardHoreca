"use client";

import { useEffect, useState } from "react";
import type { ContantRegel } from "@/lib/boekhouding";

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
  jaar: number;
  onWijziging?: () => void;
}

function euro(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

export default function ContantInvoer({ bedrijf, hex, jaar, onWijziging }: Props) {
  const [regels, setRegels] = useState<ContantRegel[]>([]);
  const [bezig, setBezig] = useState(false);
  const [toonFormulier, setToonFormulier] = useState(false);

  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [omschrijving, setOmschrijving] = useState("");
  const [bedrag, setBedrag] = useState("");
  const [tarief, setTarief] = useState<0 | 9 | 21>(9);
  const [type, setType] = useState<"inkomst" | "uitgave">("uitgave");
  const [categorie, setCategorie] = useState<"kosten" | "dga-er" | "dga-mp5">("kosten");

  async function laad() {
    const res = await fetch(`/api/administratie/contant/${bedrijf}?jaar=${jaar}`);
    if (res.ok) {
      const data = await res.json();
      setRegels(data.regels ?? []);
    }
  }

  useEffect(() => { laad(); }, [bedrijf, jaar]);

  async function voegToe(e: React.FormEvent) {
    e.preventDefault();
    if (!omschrijving || !bedrag) return;
    setBezig(true);
    try {
      await fetch(`/api/administratie/contant/${bedrijf}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum, omschrijving,
          bedrag: parseFloat(bedrag.replace(",", ".")),
          tarief, type,
          categorie: type === "uitgave" && categorie !== "kosten" ? categorie : undefined,
        }),
      });
      setOmschrijving("");
      setBedrag("");
      setCategorie("kosten");
      setToonFormulier(false);
      await laad();
      onWijziging?.();
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(id: string) {
    await fetch(`/api/administratie/contant/${bedrijf}?jaar=${jaar}&id=${id}`, { method: "DELETE" });
    setRegels((prev) => prev.filter((r) => r.id !== id));
    onWijziging?.();
  }

  async function wijzigCategorie(id: string, nieuweCategorie: string) {
    // Optimistisch updaten zodat de badge meteen verandert.
    setRegels((prev) => prev.map((r) =>
      r.id === id ? { ...r, categorie: nieuweCategorie === "kosten" ? undefined : nieuweCategorie } : r
    ));
    await fetch(`/api/administratie/contant/${bedrijf}?jaar=${jaar}&id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie: nieuweCategorie }),
    });
    onWijziging?.();
  }

  const totaalInkomsten = regels.filter((r) => r.type === "inkomst").reduce((s, r) => s + r.bedrag, 0);
  const totaalUitgaven  = regels.filter((r) => r.type === "uitgave").reduce((s, r) => s + r.bedrag, 0);
  const totaalBtw = regels.reduce((s, r) => s + r.btw21 + r.btw9, 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Contante transacties</h3>
          <p className="text-[11px] text-slate-400">Handmatig invullen, BTW wordt automatisch berekend</p>
        </div>
        <button
          onClick={() => setToonFormulier(!toonFormulier)}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ backgroundColor: hex }}
        >
          + Toevoegen
        </button>
      </div>

      {toonFormulier && (
        <form onSubmit={voegToe} className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-[11px] text-slate-500">
              Type
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "inkomst" | "uitgave")}
                className="mt-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
              >
                <option value="uitgave">Uitgave</option>
                <option value="inkomst">Inkomst</option>
              </select>
            </label>
            <label className="flex flex-col text-[11px] text-slate-500">
              Datum
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="mt-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
                required
              />
            </label>
          </div>

          <label className="flex flex-col text-[11px] text-slate-500">
            Omschrijving
            <input
              type="text"
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              placeholder="bijv. Meledi contant"
              className="mt-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-[11px] text-slate-500">
              Bedrag (incl. BTW)
              <input
                type="text"
                value={bedrag}
                onChange={(e) => setBedrag(e.target.value)}
                placeholder="0,00"
                className="mt-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
                required
              />
            </label>
            <label className="flex flex-col text-[11px] text-slate-500">
              BTW tarief
              <select
                value={tarief}
                onChange={(e) => setTarief(Number(e.target.value) as 0 | 9 | 21)}
                className="mt-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
              >
                <option value={9}>9% (levensmiddelen)</option>
                <option value={21}>21% (overige)</option>
                <option value={0}>0% (geen BTW)</option>
              </select>
            </label>
          </div>

          {type === "uitgave" && (
            <label className="flex flex-col text-[11px] text-slate-500">
              Categorie
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value as "kosten" | "dga-er" | "dga-mp5")}
                className="mt-1 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-slate-800"
              >
                <option value="kosten">Gewone kosten</option>
                <option value="dga-er">💼 DGA — Echt Rotterdams (Ricardo)</option>
                <option value="dga-mp5">💼 DGA — MP5 (Matthieu)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1">
                Bij DGA wordt het bedrag opgeteld bij DGA-onttrekkingen, niet bij gewone kasuitgaven.
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={bezig}
              className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: hex }}
            >
              {bezig ? "Opslaan…" : "Opslaan"}
            </button>
            <button
              type="button"
              onClick={() => setToonFormulier(false)}
              className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 border border-slate-200"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}

      {regels.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">Nog geen contante transacties.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {regels.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    r.type === "inkomst" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {r.type}
                  </span>
                  {r.categorie === "dga-er" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                      💼 DGA — Ricardo
                    </span>
                  )}
                  {r.categorie === "dga-mp5" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                      💼 DGA — Matthieu
                    </span>
                  )}
                  <span className="font-medium text-slate-800 truncate">{r.omschrijving}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {r.datum} · BTW: {euro(r.btw21 + r.btw9)}
                </div>
                {r.type === "uitgave" && (
                  <select
                    value={r.categorie ?? "kosten"}
                    onChange={(e) => wijzigCategorie(r.id, e.target.value)}
                    className="mt-1 text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                  >
                    <option value="kosten">Gewone kosten</option>
                    <option value="dga-er">💼 DGA — Ricardo</option>
                    <option value="dga-mp5">💼 DGA — Matthieu</option>
                  </select>
                )}
              </div>
              <div className="text-right ml-3 shrink-0">
                <span className={`font-semibold ${r.type === "inkomst" ? "text-green-700" : "text-red-700"}`}>
                  {r.type === "inkomst" ? "+" : "-"}{euro(r.bedrag)}
                </span>
              </div>
              <button
                onClick={() => verwijder(r.id)}
                className="ml-2 text-slate-300 hover:text-red-400 shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {regels.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-[11px] text-slate-400">Inkomsten</p>
            <p className="font-semibold text-green-700">{euro(totaalInkomsten)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Uitgaven</p>
            <p className="font-semibold text-red-700">{euro(totaalUitgaven)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Totaal BTW</p>
            <p className="font-semibold text-slate-700">{euro(totaalBtw)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
