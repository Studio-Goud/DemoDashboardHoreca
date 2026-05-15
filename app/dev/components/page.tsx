"use client";

/**
 * Showcase voor alle 10 sci-fi basiscomponenten. Eén pagina, gesegmenteerd
 * zodat je elk component met alle states ziet voordat we ze in de echte
 * app rollen.
 */
import { useState } from "react";
import { Bell, Calendar, Clock, Home, Search, Wallet } from "lucide-react";
import Button from "@/components/sf/Button";
import TextField from "@/components/sf/TextField";
import ListRow from "@/components/sf/ListRow";
import NavBar from "@/components/sf/NavBar";
import TabBar, { type TabItem } from "@/components/sf/TabBar";
import Card from "@/components/sf/Card";
import Modal from "@/components/sf/Modal";
import Toggle from "@/components/sf/Toggle";
import { Pulse, ScanBar, Shimmer } from "@/components/sf/Loading";
import Progress from "@/components/sf/Progress";
import Reveal from "@/components/sf/Reveal";
import AudioToggle from "@/components/sf/AudioToggle";

export default function ComponentsShowcase() {
  const [naam, setNaam] = useState("");
  const [iban, setIban] = useState("");
  const [pushAan, setPushAan] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [progress, setProgress] = useState(42);
  const [actiefTab, setActiefTab] = useState("home");

  const tabs: TabItem[] = [
    { id: "home", label: "Home", icon: <Home size={18} strokeWidth={1.5} /> },
    { id: "agenda", label: "Agenda", icon: <Calendar size={18} strokeWidth={1.5} /> },
    { id: "klok", label: "Klok", icon: <Clock size={18} strokeWidth={1.5} /> },
    { id: "uren", label: "Uren", icon: <Wallet size={18} strokeWidth={1.5} /> },
  ];

  return (
    <>
      <NavBar
        leading={
          <span className="font-mono text-sf-caps tracking-[0.18em] uppercase" style={{ color: "var(--sf-accent)" }}>
            sf-components
          </span>
        }
        center={
          <span className="font-display text-sf-h3" style={{ color: "var(--sf-fg)" }}>
            Showcase
          </span>
        }
        trailing={
          <button
            aria-label="Notificaties"
            className="w-11 h-11 flex items-center justify-center rounded-sf hover:bg-sf-glass transition-colors"
            style={{ color: "var(--sf-fg-muted)" }}
          >
            <Bell size={18} strokeWidth={1.5} />
          </button>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-10 pb-32 space-y-12">
        {/* ─── Buttons ────────────────────────────────────────────────── */}
        <Section nummer="01" titel="Button">
          <Stack>
            <Row>
              <Button variant="primary">Primary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="bracket">Run</Button>
              <Button variant="danger">Verwijderen</Button>
            </Row>
            <Row>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </Row>
            <Row>
              <Button glow="intense">Intense glow</Button>
              <Button disabled>Disabled</Button>
            </Row>
          </Stack>
        </Section>

        {/* ─── TextField ──────────────────────────────────────────────── */}
        <Section nummer="02" titel="TextField">
          <Card variant="solid" className="p-6 space-y-5">
            <TextField
              label="Voornaam"
              placeholder="bv. Ricardo"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              autoComplete="given-name"
            />
            <TextField
              label="IBAN"
              unit="€"
              placeholder="NL00 RABO 0000 0000 00"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              hint="Voor maandelijkse loonbetaling"
              autoComplete="off"
            />
            <TextField
              label="BSN"
              placeholder="9 cijfers"
              fout="Ongeldig — 11-proef faalt"
              inputMode="numeric"
            />
          </Card>
        </Section>

        {/* ─── ListRow ────────────────────────────────────────────────── */}
        <Section nummer="03" titel="ListRow">
          <Card variant="solid">
            <ListRow
              leading={<Home size={18} strokeWidth={1.5} />}
              label="Brunch & Brew"
              ondertitel="11 actieve klanten · €1.847"
              trailing={
                <span className="font-mono text-sf-mono" style={{ color: "var(--sf-accent)" }}>→</span>
              }
              onClick={() => alert("Brunch & Brew geselecteerd")}
            />
            <ListRow
              leading={<Calendar size={18} strokeWidth={1.5} />}
              label="Saté Lounge"
              ondertitel="11 actieve klanten · €940"
              trailing={
                <span className="font-mono text-sf-mono" style={{ color: "var(--sf-accent)" }}>→</span>
              }
              onClick={() => alert("Saté Lounge geselecteerd")}
            />
            <ListRow
              leading={<Clock size={18} strokeWidth={1.5} />}
              label="Het Kroket Loket"
              ondertitel="14 actieve klanten · €612"
              trailing={
                <span className="font-mono text-sf-mono" style={{ color: "var(--sf-accent)" }}>→</span>
              }
              onClick={() => alert("Het Kroket Loket geselecteerd")}
              isLast
            />
          </Card>
        </Section>

        {/* ─── Card varianten ─────────────────────────────────────────── */}
        <Section nummer="04" titel="Card">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="font-mono text-sf-caps uppercase tracking-wider mb-1" style={{ color: "var(--sf-fg-muted)" }}>
                Default · glass
              </p>
              <p className="font-display text-sf-h2" style={{ color: "var(--sf-fg)" }}>€3.399</p>
              <p className="font-mono text-sf-mono" style={{ color: "var(--sf-success)" }}>+18.4%</p>
            </Card>
            <Card variant="solid" className="p-4">
              <p className="font-mono text-sf-caps uppercase tracking-wider mb-1" style={{ color: "var(--sf-fg-muted)" }}>
                Solid
              </p>
              <p className="font-display text-sf-h2" style={{ color: "var(--sf-fg)" }}>23</p>
              <p className="font-mono text-sf-mono" style={{ color: "var(--sf-fg-muted)" }}>klanten</p>
            </Card>
            <Card variant="elevated" accent className="p-4">
              <p className="font-mono text-sf-caps uppercase tracking-wider mb-1" style={{ color: "var(--sf-accent)" }}>
                Elevated · accent
              </p>
              <p className="font-display text-sf-h2" style={{ color: "var(--sf-fg)" }}>€940</p>
              <p className="font-mono text-sf-mono" style={{ color: "var(--sf-fg-muted)" }}>SL · live</p>
            </Card>
          </div>
        </Section>

        {/* ─── Toggle ─────────────────────────────────────────────────── */}
        <Section nummer="05" titel="Toggle">
          <Card variant="solid" className="px-5 py-2">
            <Toggle
              checked={pushAan}
              onChange={setPushAan}
              label="Push-notificaties"
              beschrijving="Krijg meldingen bij voorraad-alerts en nieuwe roosters"
            />
            <div className="border-t" style={{ borderColor: "var(--sf-hairline)" }} />
            <Toggle
              checked={autoplay}
              onChange={setAutoplay}
              label="Boot-sequence elke keer"
              beschrijving="Speelt de cinematic intro bij elke app-open"
            />
            <div className="border-t" style={{ borderColor: "var(--sf-hairline)" }} />
            <Toggle
              checked={false}
              onChange={() => {}}
              disabled
              label="Disabled toggle"
              beschrijving="Voor wanneer een feature niet beschikbaar is"
            />
          </Card>
        </Section>

        {/* ─── Modal ──────────────────────────────────────────────────── */}
        <Section nummer="06" titel="Modal · Sheet">
          <Row>
            <Button onClick={() => setModalOpen(true)}>Open centered modal</Button>
            <Button variant="ghost" onClick={() => setSheetOpen(true)}>Open sheet</Button>
          </Row>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} titel="Bevestig actie">
            <div className="p-6">
              <h3 className="font-display text-sf-h2 mb-2" style={{ color: "var(--sf-fg)" }}>
                Bevestig actie
              </h3>
              <p className="text-sf-body mb-6" style={{ color: "var(--sf-fg-muted)" }}>
                Modal met ESC-handler, click-outside dismiss en focus-trap.
                Voldoet aan WCAG 2.1 dialog-pattern.
              </p>
              <Row>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuleren</Button>
                <Button onClick={() => setModalOpen(false)}>Bevestigen</Button>
              </Row>
            </div>
          </Modal>
          <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} titel="Bottom sheet" variant="sheet">
            <div className="p-6 pb-8">
              <div className="w-12 h-1 rounded-full mx-auto mb-5"
                   style={{ background: "var(--sf-hairline-strong)" }} />
              <h3 className="font-display text-sf-h2 mb-2" style={{ color: "var(--sf-fg)" }}>
                Sheet variant
              </h3>
              <p className="text-sf-body mb-4" style={{ color: "var(--sf-fg-muted)" }}>
                Komt van onderkant, beter voor mobiele tap-flows.
              </p>
              <Button onClick={() => setSheetOpen(false)} className="w-full">Sluiten</Button>
            </div>
          </Modal>
        </Section>

        {/* ─── Loading ────────────────────────────────────────────────── */}
        <Section nummer="07" titel="Loading patterns">
          <Card variant="solid" className="p-5 space-y-5">
            <div>
              <p className="font-mono text-sf-caps uppercase tracking-wider mb-2" style={{ color: "var(--sf-fg-muted)" }}>
                Pulse · inline indicator
              </p>
              <Pulse label="Synct Shiftbase" />
            </div>
            <div>
              <p className="font-mono text-sf-caps uppercase tracking-wider mb-2" style={{ color: "var(--sf-fg-muted)" }}>
                ScanBar · "fetch in progress"
              </p>
              <ScanBar />
            </div>
            <div>
              <p className="font-mono text-sf-caps uppercase tracking-wider mb-2" style={{ color: "var(--sf-fg-muted)" }}>
                Shimmer · skeleton-placeholder
              </p>
              <div className="space-y-2">
                <Shimmer height={20} width="60%" />
                <Shimmer height={14} width="90%" />
                <Shimmer height={14} width="75%" />
              </div>
            </div>
          </Card>
        </Section>

        {/* ─── Progress ───────────────────────────────────────────────── */}
        <Section nummer="08" titel="Progress">
          <Card variant="solid" className="p-5 space-y-4">
            <Progress waarde={progress} label="Maand-omzet vs target" />
            <Progress waarde={73} label="Onboarding voltooid" />
            <Progress waarde={100} label="Sync compleet" />
            <Row>
              <Button size="sm" variant="ghost" onClick={() => setProgress((p) => Math.max(0, p - 20))}>
                -20
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProgress((p) => Math.min(100, p + 20))}>
                +20
              </Button>
            </Row>
          </Card>
        </Section>

        {/* ─── TabBar preview (interactieve demo onderaan pagina) ─────── */}
        <Section nummer="09" titel="TabBar">
          <p className="text-sf-body" style={{ color: "var(--sf-fg-muted)" }}>
            Floating tab-bar zit vast onderaan dit scherm — tik 'm uit om te schakelen.
            Actieve tab krijgt cyan glow + accent-tint.
          </p>
        </Section>

        {/* ─── NavBar (al gerenderd bovenaan) ─────────────────────────── */}
        <Section nummer="10" titel="NavBar">
          <p className="text-sf-body" style={{ color: "var(--sf-fg-muted)" }}>
            Bovenaan deze pagina zie je 'm: glassmorphism met backdrop-blur,
            safe-area-inset top, drie slots (leading/center/trailing).
          </p>
        </Section>

        {/* ─── AudioToggle ────────────────────────────────────────────── */}
        <Section nummer="11" titel="Audio cues">
          <Card variant="solid" className="p-5">
            <p className="text-sf-body mb-4" style={{ color: "var(--sf-fg-muted)" }}>
              iOS PWA's hebben geen vibration-API; audio is een subtiele
              substituut. Zet aan en tik daarna een willekeurige sf-Button —
              je hoort een korte tikje (1500 Hz, 25ms, vol 4%). Voicing
              komt uit lib/audio.ts cues map.
            </p>
            <AudioToggle />
          </Card>
        </Section>
      </main>

      <TabBar tabs={tabs} actiefId={actiefTab} onSelect={setActiefTab} />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Section({ nummer, titel, children }: { nummer: string; titel: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-sf-caps tracking-[0.2em] uppercase" style={{ color: "var(--sf-accent)" }}>
            {nummer}
          </span>
          <h2 className="font-display text-sf-h1 tracking-tight" style={{ color: "var(--sf-fg)" }}>
            {titel}
          </h2>
        </div>
        {children}
      </section>
    </Reveal>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap">{children}</div>;
}
