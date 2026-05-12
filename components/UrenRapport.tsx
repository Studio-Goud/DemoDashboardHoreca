"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

interface Regel {
  id: number;
  voornaam: string;
  achternaam: string;
  gewerkteUren: number;
  aantalDiensten: number;
  uurloon: number | null;
  vakantiegeldPct: number;
  vakantieUrenPct: number;
  basisLoon: number;
  vakantiegeld: number;
  vakantieUren: number;
  totaalBruto: number;
}

interface Data {
  bedrijf: string;
  maand: string;
  regels: Regel[];
  totalen: {
    uren: number;
    diensten: number;
    basisLoon: number;
    vakantiegeld: number;
    vakantieUren: number;
    totaalBruto: number;
  };
}

interface Props {
  bedrijf: string;
  naam: string;
  hex: string;
  maand: string; // YYYY-MM
}

const MAAND_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function fmtEur(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vorigeMaand(maand: string): string {
  const [y, m] = maand.split("-").map(Number);
  const datum = new Date(y, m - 2, 1);
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}`;
}
function volgendeMaand(maand: string): string {
  const [y, m] = maand.split("-").map(Number);
  const datum = new Date(y, m, 1);
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}`;
}

export default function UrenRapport({ bedrijf, naam, hex, maand }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/uren-rapport/${bedrijf}?maand=${maand}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [bedrijf, maand]);

  const [y, m] = maand.split("-").map(Number);
  const maandLabel = `${MAAND_NL[m - 1]} ${y}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/${bedrijf}`} className="text-[12px] flex items-center gap-1" style={{ color: "var(--muted)" }}>
            <Icon name="chevron-right" size={14} className="rotate-180" />
            Terug
          </Link>
          <div className="min-w-0">
            <p className="eyebrow">Uren-rapport · {naam}</p>
            <h1 className="text-[20px] font-semibold capitalize" style={{ color: "var(--text)" }}>
              {maandLabel}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="segmented">
            <Link href={`?maand=${vorigeMaand(maand)}`} className="segmented-item" aria-label="Vorige maand">
              <Icon name="chevron-right" size={14} className="rotate-180" />
            </Link>
            <Link href={`?maand=${volgendeMaand(maand)}`} className="segmented-item" aria-label="Volgende maand">
              <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          <a
            href={`/api/uren-rapport/${bedrijf}?maand=${maand}&formaat=csv`}
            className="px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium text-white"
            style={{ background: hex }}
            download
          >
            Download CSV
          </a>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="h-5 rounded animate-pulse" style={{ background: "var(--hairline)" }} />
        </div>
      ) : !data || data.regels.length === 0 ? (
        <div className="card text-center py-8">
          <Icon name="info" size={28} className="mx-auto opacity-30 mb-2" />
          <p className="text-[14px]" style={{ color: "var(--muted)" }}>
            Geen gepubliceerde diensten in {maandLabel.toLowerCase()}
          </p>
        </div>
      ) : (
        <>
          {/* Totalen */}
          <div className="card grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Kpi label="Totale uren"   waarde={`${data.totalen.uren.toFixed(1)}u`} hex={hex} />
            <Kpi label="Basisloon"     waarde={fmtEur(data.totalen.basisLoon)} hex={hex} />
            <Kpi label="+ vakantiegeld + uren" waarde={fmtEur(data.totalen.vakantiegeld + data.totalen.vakantieUren)} hex={hex} />
            <Kpi label="Totaal bruto"  waarde={fmtEur(data.totalen.totaalBruto)} hex={hex} highlight />
          </div>

          {/* Tabel */}
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-[12px]" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 760 }}>
              <thead>
                <tr>
                  <Th>Medewerker</Th>
                  <Th align="right">Uren</Th>
                  <Th align="right">Uurloon</Th>
                  <Th align="right">Basisloon</Th>
                  <Th align="right">Vak.geld</Th>
                  <Th align="right">Vak.uren</Th>
                  <Th align="right">Bruto totaal</Th>
                </tr>
              </thead>
              <tbody>
                {data.regels.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>
                        {r.voornaam}
                      </span>{" "}
                      <span style={{ color: "var(--muted)" }}>{r.achternaam}</span>
                      {r.uurloon === null && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(229,72,77,0.10)", color: "#E5484D" }}>
                          uurloon ontbreekt
                        </span>
                      )}
                    </Td>
                    <Td align="right">{r.gewerkteUren.toFixed(1)}u</Td>
                    <Td align="right">{r.uurloon !== null ? fmtEur(r.uurloon) : "—"}</Td>
                    <Td align="right">{fmtEur(r.basisLoon)}</Td>
                    <Td align="right" muted>{fmtEur(r.vakantiegeld)}</Td>
                    <Td align="right" muted>{fmtEur(r.vakantieUren)}</Td>
                    <Td align="right" bold>{fmtEur(r.totaalBruto)}</Td>
                  </tr>
                ))}
                <tr style={{ background: "var(--bg)" }}>
                  <Td bold>TOTAAL</Td>
                  <Td align="right" bold>{data.totalen.uren.toFixed(1)}u</Td>
                  <Td align="right">—</Td>
                  <Td align="right" bold>{fmtEur(data.totalen.basisLoon)}</Td>
                  <Td align="right" muted>{fmtEur(data.totalen.vakantiegeld)}</Td>
                  <Td align="right" muted>{fmtEur(data.totalen.vakantieUren)}</Td>
                  <Td align="right" bold>{fmtEur(data.totalen.totaalBruto)}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
            Berekening: gewerkte uren × uurloon = basisloon · vakantiegeld en vakantie-uren als percentage erbovenop.
            Beide worden direct met het uurloon uitbetaald. Defaults per medewerker: 8,33% / 8,00% (aan te passen in Medewerker-beheer).
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, waarde, hex, highlight }: { label: string; waarde: string; hex: string; highlight?: boolean }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p
        className="text-[18px] font-semibold tabular-nums"
        style={{ color: highlight ? hex : "var(--text)", letterSpacing: "-0.014em" }}
      >
        {waarde}
      </p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className="p-3 text-[11px] uppercase tracking-wider font-medium"
      style={{
        color: "var(--muted)",
        borderBottom: "1px solid var(--hairline)",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align, bold, muted }: {
  children: React.ReactNode;
  align?: "right";
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className="p-3 tabular-nums"
      style={{
        borderBottom: "1px solid var(--hairline-2)",
        textAlign: align ?? "left",
        fontWeight: bold ? 600 : 400,
        color: muted ? "var(--muted)" : "var(--text)",
      }}
    >
      {children}
    </td>
  );
}
