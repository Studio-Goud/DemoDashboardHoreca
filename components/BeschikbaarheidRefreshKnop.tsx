"use client";

/**
 * Knop die de Shiftbase-beschikbaarheid cache invalideert + de huidige
 * rooster-pagina opnieuw rendert. Voor wanneer medewerkers net in
 * Shiftbase hun beschikbaarheid hebben aangepast en de owner/manager
 * dat live wil zien zonder de 30-seconden cache af te wachten.
 *
 * Verdwijnt zodra medewerkers hun beschikbaarheid via /m/beschikbaarheid
 * doorgeven — Shiftbase is dan niet meer de bron.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

interface Props { hex: string }

export default function BeschikbaarheidRefreshKnop({ hex }: Props) {
  const router = useRouter();
  const [bezig, setBezig] = useState(false);
  const [stempel, setStempel] = useState<Date | null>(null);
  const [samenvatting, setSamenvatting] = useState<string | null>(null);

  async function refresh() {
    setBezig(true);
    try {
      const res = await fetch("/api/shiftbase/refresh-beschikbaarheid", { method: "POST" });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Rustig aan — even wachten.");
        return;
      }
      if (!res.ok) {
        alert("Refresh mislukt.");
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (typeof j.nieuw === "number") {
        setSamenvatting(`${j.nieuw} nieuw · ${j.bijgewerkt} bijgewerkt`);
      }
      router.refresh();
      setStempel(new Date());
    } finally {
      setBezig(false);
    }
  }

  return (
    <button
      onClick={refresh}
      disabled={bezig}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
      style={{
        background: "var(--bg-elev)",
        border: `1px solid ${hex}`,
        color: hex,
      }}
      title="Beschikbaarheid uit Shiftbase opnieuw ophalen"
    >
      <Icon name="refresh" size={13} className={bezig ? "animate-spin" : ""} />
      <span>{bezig ? "Bezig…" : "Beschikbaarheid sync"}</span>
      {stempel && !bezig && (
        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
          {samenvatting ?? stempel.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </button>
  );
}
