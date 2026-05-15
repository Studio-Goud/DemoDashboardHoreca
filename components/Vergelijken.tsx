"use client";

import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameMonth,
  getDay,
  addDays,
} from "date-fns";
import { nl } from "date-fns/locale";
import type { DagOmzet, MaandOmzet } from "@/lib/analytics";
import { feestdagOpDatum, seizoen, vakantieOpDatum, zoekFeestdagInJaar } from "@/lib/feestdagen";

interface JaarTotaal {
  jaar: number;
  omzet: number;
  txs: number;
}

interface Props {
  dagOmzet: DagOmzet[];
  maandOmzet: MaandOmzet[];
  jaarTotalen: JaarTotaal[];
  hex: string;
}

type Tab = "dag" | "maand" | "jaar" | "seizoen";

function fmtEur(n: number): string {
  return `€${n.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtEurKort(n: number): string {
  if (Math.abs(n) >= 10000)
    return `€${(n / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}k`;
  return `€${n.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`;
}

function groei(huidig: number, vorig: number): number {
  if (vorig <= 0) return huidig > 0 ? 100 : 0;
  return Math.round(((huidig - vorig) / vorig) * 10) / 10;
}

function Delta({ waarde }: { waarde: number }) {
  if (waarde === 0)
    return <span className="text-slate-400 text-xs">±0%</span>;
  const pos = waarde > 0;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        pos ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {pos ? "▲ +" : "▼ "}
      {waarde}%
    </span>
  );
}

function VergelijkRij({
  label,
  waarde,
  hulpTekst,
  referentie,
}: {
  label: string;
  waarde: number | null;
  hulpTekst?: string;
  referentie?: number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm text-slate-700 font-medium">{label}</p>
        {hulpTekst && (
          <p className="text-[11px] text-slate-400">{hulpTekst}</p>
        )}
      </div>
      <p className="text-sm tabular-nums font-semibold text-slate-900">
        {waarde !== null ? fmtEur(waarde) : "—"}
      </p>
      <div className="w-14 text-right">
        {waarde !== null && referentie != null && referentie > 0 ? (
          <Delta waarde={groei(waarde, referentie)} />
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </div>
    </div>
  );
}

export default function Vergelijken({
  dagOmzet,
  maandOmzet,
  jaarTotalen,
  hex,
}: Props) {
  const [tab, setTab] = useState<Tab>("dag");

  const dagIndex = useMemo(() => {
    const m = new Map<string, DagOmzet>();
    for (const d of dagOmzet) m.set(d.datum, d);
    return m;
  }, [dagOmzet]);

  const maandIndex = useMemo(() => {
    const m = new Map<string, MaandOmzet>();
    for (const d of maandOmzet) m.set(`${d.jaar}-${d.maand}`, d);
    return m;
  }, [maandOmzet]);

  // Default geselecteerd: gisteren voor dag, huidige maand voor maand, huidig jaar voor jaar
  const vandaag = new Date();
  const defaultDag = format(subDays(vandaag, 1), "yyyy-MM-dd");
  const defaultMaand = format(vandaag, "yyyy-MM");
  const defaultJaar = vandaag.getFullYear();

  const [geselDag, setGeselDag] = useState<string>(defaultDag);
  const [geselMaand, setGeselMaand] = useState<string>(defaultMaand);
  const [geselJaar, setGeselJaar] = useState<number>(defaultJaar);

  const dag = dagIndex.get(geselDag);
  const dagDate = parseISO(geselDag);
  const feest = feestdagOpDatum(dagDate);
  const vak = vakantieOpDatum(dagDate);

  const dagOmzetBedrag = dag?.omzet ?? null;
  const gisteren = dagIndex.get(format(subDays(dagDate, 1), "yyyy-MM-dd"));
  const vorigeWeek = dagIndex.get(format(subDays(dagDate, 7), "yyyy-MM-dd"));
  const vorigeMaand = dagIndex.get(format(subMonths(dagDate, 1), "yyyy-MM-dd"));
  // VOOR FEESTDAGEN: pak NIET dezelfde kalenderdatum vorig jaar (Pasen
  // schuift, Koningsdag schuift bij zondag), maar zoek dezelfde feestdag-
  // NAAM op in vorig jaar. Voor gewone dagen blijft het simpele
  // subYears(dagDate, 1) — dat valt op dezelfde maand-dag.
  const vorigJaarDate = feest
    ? zoekFeestdagInJaar(feest.naam, dagDate.getFullYear() - 1)?.datum
      ?? subYears(dagDate, 1)
    : subYears(dagDate, 1);
  const vorigJaar = dagIndex.get(format(vorigJaarDate, "yyyy-MM-dd"));
  // Was de vorig-jaar-vergelijking ook een feestdag? (Voor gewone dagen
  // is dit een hint dat vorig jaar er TOEN wel een feestdag op de zelfde
  // kalenderdatum viel — die vergelijking is dan misleidend.)
  const vorigJaarFeest = feestdagOpDatum(vorigJaarDate);

  // Gem. zelfde weekdag in laatste 8 weken (exclusief zichzelf)
  const zelfdeWdGem = useMemo(() => {
    const wd = getDay(dagDate);
    const omzetten: number[] = [];
    for (let i = 1; i <= 56; i++) {
      const d = dagIndex.get(format(subDays(dagDate, i), "yyyy-MM-dd"));
      if (d && getDay(parseISO(d.datum)) === wd && !feestdagOpDatum(parseISO(d.datum))) {
        omzetten.push(d.omzet);
      }
    }
    if (omzetten.length === 0) return null;
    return Math.round((omzetten.reduce((a, b) => a + b, 0) / omzetten.length) * 100) / 100;
  }, [dagDate, dagIndex]);

  // Maand
  const [jaarStr, maandStr] = geselMaand.split("-");
  const maandKey = `${jaarStr}-${parseInt(maandStr, 10)}`;
  const maandD = maandIndex.get(maandKey);
  const vorigMaandDate = subMonths(new Date(Number(jaarStr), Number(maandStr) - 1, 1), 1);
  const vorigMaandKey = `${vorigMaandDate.getFullYear()}-${vorigMaandDate.getMonth() + 1}`;
  const vorigMaandD = maandIndex.get(vorigMaandKey);
  const vorigJaarSelfMaandKey = `${Number(jaarStr) - 1}-${parseInt(maandStr, 10)}`;
  const vorigJaarSelfMaandD = maandIndex.get(vorigJaarSelfMaandKey);

  // Maand-dagen detail: sum per week binnen de maand
  const maandStart = startOfMonth(new Date(Number(jaarStr), Number(maandStr) - 1, 1));
  const maandEind = endOfMonth(maandStart);
  const maandDagen: DagOmzet[] = dagOmzet.filter((d) => {
    const dt = parseISO(d.datum);
    return dt >= maandStart && dt <= maandEind;
  });

  // Jaar
  const jaarD = jaarTotalen.find((j) => j.jaar === geselJaar);
  const vorigJaarD = jaarTotalen.find((j) => j.jaar === geselJaar - 1);

  // Per-maand van dit jaar (voor lijst)
  const maandenInJaar = Array.from({ length: 12 }, (_, i) => {
    const huidig = maandIndex.get(`${geselJaar}-${i + 1}`);
    const vorig = maandIndex.get(`${geselJaar - 1}-${i + 1}`);
    return {
      maandNr: i + 1,
      huidig: huidig?.omzet ?? 0,
      vorig: vorig?.omzet ?? 0,
    };
  });

  // Seizoen (voor seizoen tab)
  const [geselSeizoen, setGeselSeizoen] = useState<"winter" | "lente" | "zomer" | "herfst">(
    seizoen(new Date())
  );
  const perJaarSeizoen = useMemo(() => {
    const map = new Map<number, { omzet: number; txs: number }>();
    for (const d of dagOmzet) {
      if (seizoen(parseISO(d.datum)) !== geselSeizoen) continue;
      const j = parseISO(d.datum).getFullYear();
      const cur = map.get(j) ?? { omzet: 0, txs: 0 };
      cur.omzet += d.omzet;
      cur.txs += d.aantalTransacties;
      map.set(j, cur);
    }
    return Array.from(map.entries())
      .map(([jaar, v]) => ({ jaar, ...v }))
      .sort((a, b) => a.jaar - b.jaar);
  }, [dagOmzet, geselSeizoen]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "dag", label: "Dag" },
    { key: "maand", label: "Maand" },
    { key: "jaar", label: "Jaar" },
    { key: "seizoen", label: "Seizoen" },
  ];

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-slate-700">Vergelijken</h3>
          <p className="text-[11px] text-slate-400">
            Zoek terug: wat deden we op deze dag, in deze maand, dit jaar of seizoen?
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                tab === t.key
                  ? "bg-white text-slate-900 font-semibold shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dag" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">Kies een dag:</label>
            <input
              type="date"
              value={geselDag}
              onChange={(e) => setGeselDag(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900"
            />
            <div className="flex gap-1">
              <button
                className="px-2 py-1 text-[11px] rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                onClick={() => setGeselDag(format(vandaag, "yyyy-MM-dd"))}
              >
                Vandaag
              </button>
              <button
                className="px-2 py-1 text-[11px] rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                onClick={() => setGeselDag(format(subDays(vandaag, 1), "yyyy-MM-dd"))}
              >
                Gisteren
              </button>
            </div>
          </div>

          <div
            className="rounded-xl p-4 mb-3 border"
            style={{ backgroundColor: `${hex}10`, borderColor: `${hex}55` }}
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {format(dagDate, "EEEE dd-MM-yyyy", { locale: nl })}
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: hex }}>
              {dagOmzetBedrag !== null ? fmtEur(dagOmzetBedrag) : "—"}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {dag && (
                <span className="text-[11px] text-slate-500">
                  {dag.aantalTransacties} tx · gem. €
                  {(dag.omzet / Math.max(dag.aantalTransacties, 1)).toFixed(2)}
                </span>
              )}
              {feest && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded">
                  {feest.naam}
                </span>
              )}
              {!feest && vak && (
                <span className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 rounded">
                  {vak.naam}
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
              Vergelijkingen
            </p>
            <VergelijkRij
              label="Gisteren"
              hulpTekst={format(subDays(dagDate, 1), "EEEE dd-MM-yyyy", { locale: nl })}
              waarde={gisteren?.omzet ?? null}
              referentie={dagOmzetBedrag}
            />
            <VergelijkRij
              label="Zelfde dag vorige week"
              hulpTekst={format(subDays(dagDate, 7), "EEEE dd-MM-yyyy", { locale: nl })}
              waarde={vorigeWeek?.omzet ?? null}
              referentie={dagOmzetBedrag}
            />
            <VergelijkRij
              label="Zelfde datum vorige maand"
              hulpTekst={format(subMonths(dagDate, 1), "EEEE dd-MM-yyyy", { locale: nl })}
              waarde={vorigeMaand?.omzet ?? null}
              referentie={dagOmzetBedrag}
            />
            <VergelijkRij
              label={feest ? `${feest.naam} vorig jaar` : "Zelfde datum vorig jaar"}
              hulpTekst={
                feest
                  ? `${format(vorigJaarDate, "EEEE dd-MM-yyyy", { locale: nl })} (zelfde feestdag, niet kalenderdatum)`
                  : vorigJaarFeest
                  ? `${format(vorigJaarDate, "EEEE dd-MM-yyyy", { locale: nl })} ⚠ was ${vorigJaarFeest.naam}`
                  : format(vorigJaarDate, "EEEE dd-MM-yyyy", { locale: nl })
              }
              waarde={vorigJaar?.omzet ?? null}
              referentie={dagOmzetBedrag}
            />
            <VergelijkRij
              label="Gem. zelfde weekdag (laatste 8 weken)"
              hulpTekst={feest ? "feestdagen uitgesloten" : "excl. feestdagen"}
              waarde={zelfdeWdGem}
              referentie={dagOmzetBedrag}
            />
          </div>
        </div>
      )}

      {tab === "maand" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">Kies een maand:</label>
            <input
              type="month"
              value={geselMaand}
              onChange={(e) => setGeselMaand(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900"
            />
          </div>

          <div
            className="rounded-xl p-4 mb-3 border"
            style={{ backgroundColor: `${hex}10`, borderColor: `${hex}55` }}
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {format(maandStart, "MMMM yyyy", { locale: nl })}
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: hex }}>
              {maandD ? fmtEur(maandD.omzet) : "—"}
            </p>
            {maandD && (
              <p className="text-[11px] text-slate-500 mt-1">
                {maandD.txs.toLocaleString("nl-NL")} tx · gem. €
                {(maandD.omzet / Math.max(maandD.txs, 1)).toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
              Vergelijkingen
            </p>
            <VergelijkRij
              label="Vorige maand"
              hulpTekst={format(vorigMaandDate, "MMMM yyyy", { locale: nl })}
              waarde={vorigMaandD?.omzet ?? null}
              referentie={maandD?.omzet ?? null}
            />
            <VergelijkRij
              label="Zelfde maand vorig jaar"
              hulpTekst={format(
                subYears(maandStart, 1),
                "MMMM yyyy",
                { locale: nl }
              )}
              waarde={vorigJaarSelfMaandD?.omzet ?? null}
              referentie={maandD?.omzet ?? null}
            />
          </div>

          {maandDagen.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                Weekopbouw in {format(maandStart, "MMMM", { locale: nl })}
              </p>
              <div className="space-y-2">
                {(() => {
                  const weken = new Map<number, { van: Date; tot: Date; omzet: number; txs: number }>();
                  for (const d of maandDagen) {
                    const dt = parseISO(d.datum);
                    const jaarWk = Number(format(dt, "I", { locale: nl }));
                    const cur = weken.get(jaarWk) ?? {
                      van: dt,
                      tot: dt,
                      omzet: 0,
                      txs: 0,
                    };
                    cur.omzet += d.omzet;
                    cur.txs += d.aantalTransacties;
                    if (dt < cur.van) cur.van = dt;
                    if (dt > cur.tot) cur.tot = dt;
                    weken.set(jaarWk, cur);
                  }
                  const lijst = Array.from(weken.entries()).sort((a, b) => a[0] - b[0]);
                  const max = Math.max(...lijst.map(([, v]) => v.omzet), 1);
                  return lijst.map(([wk, v]) => (
                    <div key={wk} className="flex items-center gap-3 text-xs">
                      <span className="w-16 text-slate-500 shrink-0">
                        wk {wk}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(v.omzet / max) * 100}%`,
                            backgroundColor: hex,
                            opacity: 0.8,
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-slate-700 font-medium w-20 text-right">
                        {fmtEurKort(v.omzet)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "jaar" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">Kies een jaar:</label>
            <select
              value={geselJaar}
              onChange={(e) => setGeselJaar(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900"
            >
              {jaarTotalen
                .slice()
                .sort((a, b) => b.jaar - a.jaar)
                .map((j) => (
                  <option key={j.jaar} value={j.jaar}>
                    {j.jaar}
                  </option>
                ))}
              {!jaarTotalen.some((j) => j.jaar === defaultJaar) && (
                <option value={defaultJaar}>{defaultJaar} (YTD)</option>
              )}
            </select>
          </div>

          <div
            className="rounded-xl p-4 mb-3 border"
            style={{ backgroundColor: `${hex}10`, borderColor: `${hex}55` }}
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {geselJaar}
              {geselJaar === defaultJaar ? " (YTD)" : ""}
            </p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: hex }}>
              {jaarD ? fmtEur(jaarD.omzet) : "—"}
            </p>
            {jaarD && jaarD.txs > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                {jaarD.txs.toLocaleString("nl-NL")} tx · gem. €
                {(jaarD.omzet / Math.max(jaarD.txs, 1)).toFixed(2)}
              </p>
            )}
          </div>

          <VergelijkRij
            label={`Vorig jaar (${geselJaar - 1})`}
            waarde={vorigJaarD?.omzet ?? null}
            referentie={jaarD?.omzet ?? null}
          />

          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
              Per maand — {geselJaar} vs {geselJaar - 1}
            </p>
            <div className="space-y-1.5">
              {maandenInJaar.map((m) => {
                const groeiPct =
                  m.vorig > 0
                    ? Math.round(((m.huidig - m.vorig) / m.vorig) * 100)
                    : null;
                const max = Math.max(
                  ...maandenInJaar.map((x) => Math.max(x.huidig, x.vorig)),
                  1
                );
                return (
                  <div key={m.maandNr} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs">
                    <span className="w-10 text-slate-500 shrink-0">
                      {format(new Date(2020, m.maandNr - 1, 1), "MMM", { locale: nl })}
                    </span>
                    <div className="space-y-1">
                      {m.huidig > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(m.huidig / max) * 100}%`,
                                backgroundColor: hex,
                              }}
                            />
                          </div>
                          <span className="tabular-nums w-16 text-right text-slate-800">
                            {fmtEurKort(m.huidig)}
                          </span>
                        </div>
                      )}
                      {m.vorig > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-300"
                              style={{ width: `${(m.vorig / max) * 100}%` }}
                            />
                          </div>
                          <span className="tabular-nums w-16 text-right text-slate-500">
                            {fmtEurKort(m.vorig)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="w-14 text-right">
                      {groeiPct !== null ? (
                        <Delta waarde={groeiPct} />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "seizoen" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs text-slate-500">Seizoen:</label>
            {(["winter", "lente", "zomer", "herfst"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setGeselSeizoen(s)}
                className={`px-3 py-1 text-xs rounded-md capitalize ${
                  geselSeizoen === s
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {perJaarSeizoen.length === 0 ? (
            <p className="text-sm text-slate-400">
              Geen data voor dit seizoen in de beschikbare historie.
            </p>
          ) : (
            <div className="space-y-1.5">
              {perJaarSeizoen.map((j, idx) => {
                const vorig = perJaarSeizoen[idx - 1];
                const groeiPct = vorig
                  ? Math.round(((j.omzet - vorig.omzet) / vorig.omzet) * 100)
                  : null;
                const max = Math.max(...perJaarSeizoen.map((x) => x.omzet), 1);
                return (
                  <div key={j.jaar} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-sm">
                    <span className="w-14 text-slate-500">{j.jaar}</span>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(j.omzet / max) * 100}%`,
                          backgroundColor: hex,
                        }}
                      />
                    </div>
                    <span className="tabular-nums w-20 text-right text-slate-800 font-medium">
                      {fmtEurKort(j.omzet)}
                    </span>
                    <div className="w-14 text-right">
                      {groeiPct !== null ? (
                        <Delta waarde={groeiPct} />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
