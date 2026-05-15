"use client";

import { useEffect, useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { nl } from "date-fns/locale";
import DetailSheet from "./sf/DetailSheet";
import { ChevronRight } from "lucide-react";

interface Tx {
  id: string;
  amount: number;
  timestamp: string;
  payment_type: string;
  products?: Array<{ name: string; quantity: number }>;
}

interface Props {
  bedrijf: "bb" | "sl" | "kl";
  hex: string;
}

function tijdGeleden(iso: string): string {
  const min = differenceInMinutes(new Date(), parseISO(iso));
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min`;
  const u = Math.floor(min / 60);
  if (u < 24) return `${u}u${min % 60 ? ` ${min % 60}m` : ""}`;
  const d = Math.floor(u / 24);
  return `${d}d`;
}

function methodeKort(payment_type: string): string {
  const m = payment_type.toLowerCase();
  if (m.includes("cash")) return "cash";
  if (m.includes("card") || m === "pos" || m.includes("pin")) return "kaart";
  return payment_type.replace(/_/g, " ");
}

export default function RecenteTransacties({ bedrijf, hex }: Props) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [laatstGeupdate, setLaatstGeupdate] = useState<Date | null>(null);
  const [actief, setActief] = useState<Tx | null>(null);

  useEffect(() => {
    let actief = true;
    async function laad() {
      try {
        const res = await fetch(`/api/sumup/${bedrijf}`, { cache: "no-store" });
        const json = await res.json();
        if (!actief) return;
        setTxs(json.recenteTransacties ?? []);
        setLaatstGeupdate(new Date());
      } catch {
        // stil
      } finally {
        if (actief) setLoading(false);
      }
    }
    laad();
    const t = setInterval(laad, 30_000);
    const onRefresh = () => laad();
    window.addEventListener("dashboard:refresh", onRefresh);
    return () => {
      actief = false;
      clearInterval(t);
      window.removeEventListener("dashboard:refresh", onRefresh);
    };
  }, [bedrijf]);

  if (loading && txs.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-3 text-slate-700">Recente transacties</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-10 bg-slate-50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (txs.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-3 text-slate-700">Recente transacties</h3>
        <p className="text-slate-400 text-sm">Nog geen recente transacties.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-slate-700">Recente transacties</h3>
        <span className="text-[11px] text-slate-400">
          {laatstGeupdate
            ? `bijgewerkt ${format(laatstGeupdate, "HH:mm:ss")}`
            : ""}
        </span>
      </div>

      <ul className="divide-y divide-slate-100 -mx-1">
        {txs.map((tx) => {
          const items =
            tx.products
              ?.slice(0, 3)
              .map((p) => `${p.quantity}× ${p.name}`)
              .join(", ") ?? "";
          const extra =
            tx.products && tx.products.length > 3
              ? ` +${tx.products.length - 3}`
              : "";
          return (
            <li key={tx.id}>
              <button
                type="button"
                onClick={() => setActief(tx)}
                className="flex items-center justify-between gap-3 px-1 py-1.5 w-full text-left hover:bg-slate-50 transition-colors rounded"
              >
                <div className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className="text-[14px] font-semibold tabular-nums text-slate-800">
                    €{tx.amount.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {methodeKort(tx.payment_type)}
                    {items && <> · {items}{extra}</>}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums shrink-0 whitespace-nowrap flex items-center gap-1">
                  {format(parseISO(tx.timestamp), "HH:mm", { locale: nl })}
                  <span className="text-slate-300 mx-1">·</span>
                  {tijdGeleden(tx.timestamp)}
                  <ChevronRight size={12} className="text-slate-300" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <DetailSheet
        open={actief !== null}
        onClose={() => setActief(null)}
        titel={actief ? `€${actief.amount.toFixed(2)}` : ""}
        subtitel={
          actief
            ? `${format(parseISO(actief.timestamp), "EEEE d MMMM · HH:mm:ss", { locale: nl })} · ${methodeKort(actief.payment_type)}`
            : ""
        }
        hex={hex}
      >
        {actief && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ background: `${hex}10`, border: `1px solid ${hex}30` }}>
              <p className="font-mono text-[9px] tracking-[0.18em] uppercase mb-1" style={{ color: hex }}>
                Bedrag
              </p>
              <p
                className="font-display text-[36px] font-semibold tabular-nums leading-none"
                style={{ color: hex, letterSpacing: "-0.018em" }}
              >
                €{actief.amount.toFixed(2)}
              </p>
              <p className="font-mono text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                Betaalwijze: {methodeKort(actief.payment_type)}
              </p>
            </div>

            {actief.products && actief.products.length > 0 ? (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sf-hairline)" }}>
                <div className="px-3 py-2 border-b" style={{ borderColor: "var(--sf-hairline)" }}>
                  <p className="font-mono text-[9px] tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                    Producten ({actief.products.length})
                  </p>
                </div>
                {actief.products.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--sf-hairline)" }}
                  >
                    <p className="text-[13px]" style={{ color: "var(--text)" }}>
                      <span className="font-mono text-[11px] tabular-nums mr-2" style={{ color: "var(--muted)" }}>
                        {p.quantity}×
                      </span>
                      {p.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                Geen product-detail beschikbaar voor deze transactie.
              </p>
            )}

            <div className="rounded-xl p-3" style={{ border: "1px solid var(--sf-hairline)" }}>
              <p className="font-mono text-[9px] tracking-wider uppercase mb-1" style={{ color: "var(--muted)" }}>
                Transactie-ID
              </p>
              <p className="font-mono text-[11px] break-all" style={{ color: "var(--text)" }}>
                {actief.id}
              </p>
            </div>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
