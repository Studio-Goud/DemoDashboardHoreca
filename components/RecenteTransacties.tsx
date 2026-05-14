"use client";

import { useEffect, useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { nl } from "date-fns/locale";

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
            <li
              key={tx.id}
              className="flex items-center justify-between gap-3 px-1 py-1.5"
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
              <div className="text-[11px] text-slate-400 tabular-nums shrink-0 whitespace-nowrap">
                {format(parseISO(tx.timestamp), "HH:mm", { locale: nl })}
                <span className="text-slate-300 mx-1">·</span>
                {tijdGeleden(tx.timestamp)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
