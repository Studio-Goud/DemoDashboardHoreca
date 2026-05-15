"use client";

/**
 * Profiel-onboarding: NAW + IBAN + BSN. BSN gaat versleuteld naar de
 * server (lib/documenten.ts → AES-256-GCM). UI laat alleen laatste 4
 * cijfers zien na opslaan.
 *
 * Foto-uploads (ID + bankpas) komen in een volgende iteratie.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DocumentenUploaden from "./DocumentenUploaden";

interface Profiel {
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string | null;
  geboortedatum: string | null;
  straat: string | null;
  huisnummer: string | null;
  postcode: string | null;
  woonplaats: string | null;
  iban: string | null;
  bsnGemaskeerd: string | null;
  onboardingVoltooid: boolean;
}

interface Props { welkom: boolean }

export default function MedewerkerProfielFlow({ welkom }: Props) {
  const router = useRouter();
  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);

  const [telefoon, setTelefoon] = useState("");
  const [geboortedatum, setGeboortedatum] = useState("");
  const [documentenCompleet, setDocumentenCompleet] = useState(false);
  const [straat, setStraat] = useState("");
  const [huisnummer, setHuisnummer] = useState("");
  const [postcode, setPostcode] = useState("");
  const [woonplaats, setWoonplaats] = useState("");
  const [iban, setIban] = useState("");
  const [bsn, setBsn] = useState("");

  useEffect(() => {
    async function laad() {
      const res = await fetch("/api/medewerker/profiel", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as Profiel;
      setProfiel(j);
      setTelefoon(j.telefoon ?? "");
      setGeboortedatum(j.geboortedatum ?? "");
      setStraat(j.straat ?? "");
      setHuisnummer(j.huisnummer ?? "");
      setPostcode(j.postcode ?? "");
      setWoonplaats(j.woonplaats ?? "");
      setIban(j.iban ?? "");
      setBsn(""); // BSN nooit pre-fillen; user moet 'm bewust opnieuw invoeren
    }
    laad();
  }, []);

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setOpgeslagen(false);
    setBezig(true);
    try {
      const body: Record<string, string> = {
        telefoon, geboortedatum, straat, huisnummer, postcode, woonplaats, iban,
      };
      // BSN alleen meesturen als 'ie is gewijzigd (ipv leeg te laten en
      // server te laten clearen)
      if (bsn.trim()) body.bsn = bsn.trim();

      const res = await fetch("/api/medewerker/profiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "fout" }));
        throw new Error(j.error || "opslaan mislukt");
      }
      const j = await res.json() as { onboardingVoltooid: boolean };
      setOpgeslagen(true);
      setBsn("");
      // Herlaad om gemaskeerde BSN te tonen
      const res2 = await fetch("/api/medewerker/profiel", { cache: "no-store" });
      if (res2.ok) setProfiel(await res2.json());
      // Als onboarding nu compleet is, ga door naar het portaal
      if (j.onboardingVoltooid && welkom) {
        setTimeout(() => router.replace("/m"), 1200);
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : "fout");
    } finally {
      setBezig(false);
    }
  }

  if (!profiel) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--hairline)", borderTopColor: "var(--text-2)" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto pb-24">
      <div className="mb-6">
        <p className="eyebrow mb-1">{welkom ? "Stap 3 van 3" : "Mijn profiel"}</p>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.019em" }}>
          {welkom ? `Welkom ${profiel.voornaam}!` : "Profiel & gegevens"}
        </h1>
        <p className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
          {welkom
            ? "Vul je adres, IBAN en BSN in zodat de loonadministratie klaar staat. Je BSN wordt versleuteld opgeslagen."
            : "Wijzig je adres, IBAN of BSN. Alle gevoelige data wordt server-side versleuteld."}
        </p>
      </div>

      <form onSubmit={opslaan} className="space-y-5">
        {/* Contact */}
        <section>
          <h2 className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Contact</h2>
          <div className="space-y-2">
            <input type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="Telefoonnummer (optioneel)"
              className="w-full px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }} />
          </div>
        </section>

        {/* Persoonsgegevens */}
        <section>
          <h2 className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Persoonsgegevens</h2>
          <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>Geboortedatum</label>
          <input type="date" required value={geboortedatum} onChange={(e) => setGeboortedatum(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[15px]"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }} />
        </section>

        {/* Adres */}
        <section>
          <h2 className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Adres</h2>
          <div className="grid grid-cols-3 gap-2">
            <input className="col-span-2 px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
              required value={straat} onChange={(e) => setStraat(e.target.value)} placeholder="Straat" />
            <input className="px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
              required value={huisnummer} onChange={(e) => setHuisnummer(e.target.value)} placeholder="Nr." />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <input className="px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
              required value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="1234 AB" />
            <input className="col-span-2 px-3 py-2.5 rounded-xl text-[15px]"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
              required value={woonplaats} onChange={(e) => setWoonplaats(e.target.value)} placeholder="Plaats" />
          </div>
        </section>

        {/* IBAN */}
        <section>
          <h2 className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Bank</h2>
          <label className="block text-[11px] mb-1" style={{ color: "var(--muted)" }}>IBAN (NL.. formaat)</label>
          <input className="w-full px-3 py-2.5 rounded-xl text-[15px] tracking-wider"
            style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
            required value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="NL00 RABO 0000 0000 00" autoComplete="off" />
        </section>

        {/* BSN */}
        <section>
          <h2 className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Burgerservicenummer</h2>
          {profiel.bsnGemaskeerd && !bsn ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)" }}>
              <span className="tabular-nums text-[15px]" style={{ color: "var(--text)" }}>{profiel.bsnGemaskeerd}</span>
              <button type="button" onClick={() => setBsn(" ")} className="text-[12px] underline" style={{ color: "var(--muted)" }}>
                Wijzigen
              </button>
            </div>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{9}"
              maxLength={9}
              required={!profiel.bsnGemaskeerd}
              value={bsn.trim()}
              onChange={(e) => setBsn(e.target.value.replace(/\D/g, ""))}
              placeholder="9 cijfers"
              className="w-full px-3 py-2.5 rounded-xl text-[15px] tabular-nums"
              style={{ background: "var(--bg-elev)", border: "1px solid var(--hairline)", color: "var(--text)" }}
              autoComplete="off"
            />
          )}
          <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
            Wordt AES-256 versleuteld opgeslagen. Alleen de eigenaar kan 'm
            inzien (voor de loonadministratie).
          </p>
        </section>

        {/* Documenten — verplicht voor onboarding */}
        <section>
          <DocumentenUploaden onCompletheid={setDocumentenCompleet} />
        </section>

        {fout && (
          <p className="text-[13px]" style={{ color: "#E5484D" }}>{fout}</p>
        )}
        {opgeslagen && !fout && (
          <p className="text-[13px]" style={{ color: "#30B26F" }}>
            ✓ Opgeslagen{profiel.onboardingVoltooid ? " — onboarding compleet" : ""}
          </p>
        )}

        <button
          type="submit"
          disabled={bezig || !documentenCompleet}
          className="w-full py-3 rounded-xl text-[15px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#30B26F" }}
          title={!documentenCompleet ? "Eerst alle 3 foto's uploaden" : ""}
        >
          {bezig
            ? "Bezig…"
            : !documentenCompleet
            ? "Upload eerst alle 3 foto's"
            : welkom
            ? "Opslaan & naar portaal"
            : "Opslaan"}
        </button>
      </form>
    </main>
  );
}
