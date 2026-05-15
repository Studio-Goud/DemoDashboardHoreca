/**
 * Idempotente DB-migraties — inline SQL constants.
 *
 * Voorheen las dit module SQL-files uit ./drizzle/ via readFileSync. Op
 * Vercel werkt dat niet: serverless functies krijgen NIET automatisch de
 * SQL-files mee in hun bundel. Daarom staan de migraties hier inline.
 *
 * Idempotent: alle statements gebruiken CREATE TABLE IF NOT EXISTS /
 * CREATE INDEX IF NOT EXISTS. Meerdere keren uitvoeren is veilig.
 */

import { sql } from "drizzle-orm";
import { db } from "./client";

export interface DbInitResultaat {
  naam: string;
  statementsUitgevoerd: number;
  duurMs: number;
}

interface Migratie {
  naam: string;
  statements: string[];
}

/**
 * Migratie 0001: audit_log + salaris_perioden.
 *
 * Een append-only log voor elke wijziging aan rosters/klok_events, plus
 * een maand-tabel voor de salaris-administratie. Beide vereist door de
 * endpoints uit PR #5 en #6.
 */
const MIGRATIE_0001: Migratie = {
  naam: "0001_audit_log_en_salaris_perioden",
  statements: [
    // ─── audit_log tabel ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "audit_log" (
      "id"                  serial PRIMARY KEY NOT NULL,
      "entiteit"            varchar(32) NOT NULL,
      "entiteit_id"         integer NOT NULL,
      "actie"               varchar(16) NOT NULL,
      "door_medewerker_id"  integer,
      "door_rol"            varchar(12),
      "oude_waarde"         text,
      "nieuwe_waarde"       text,
      "reden"               text,
      "ip_adres"            varchar(64),
      "user_agent"          text,
      "created_at"          timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "audit_log_door_medewerker_id_fk"
        FOREIGN KEY ("door_medewerker_id") REFERENCES "medewerkers"("id") ON DELETE SET NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "audit_log_entiteit_idx"
       ON "audit_log" USING btree ("entiteit", "entiteit_id")`,
    `CREATE INDEX IF NOT EXISTS "audit_log_door_idx"
       ON "audit_log" USING btree ("door_medewerker_id", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "audit_log_tijd_idx"
       ON "audit_log" USING btree ("created_at")`,

    // ─── salaris_perioden tabel ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "salaris_perioden" (
      "id"                    serial PRIMARY KEY NOT NULL,
      "medewerker_id"         integer NOT NULL,
      "jaar"                  integer NOT NULL,
      "maand"                 integer NOT NULL,
      "bruto_uren"            numeric(7, 2) NOT NULL,
      "uurloon"               numeric(6, 2) NOT NULL,
      "bruto_loon"            numeric(9, 2) NOT NULL,
      "vakantiegeld_pct"      numeric(5, 3) NOT NULL,
      "vakantiegeld_eur"      numeric(9, 2) NOT NULL,
      "vakantie_uren_pct"     numeric(5, 3) NOT NULL,
      "vakantie_uren_eur"     numeric(9, 2) NOT NULL,
      "totaal_eur"            numeric(9, 2) NOT NULL,
      "bron"                  varchar(16) DEFAULT 'rooster' NOT NULL,
      "bereken_hash"          varchar(64) NOT NULL,
      "status"                varchar(16) DEFAULT 'open' NOT NULL,
      "afgerekend_op"         timestamp with time zone,
      "afgerekend_door"       integer,
      "uitbetaald_op"         timestamp with time zone,
      "betaling_referentie"   varchar(64),
      "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at"            timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "salaris_perioden_medewerker_id_fk"
        FOREIGN KEY ("medewerker_id") REFERENCES "medewerkers"("id") ON DELETE CASCADE,
      CONSTRAINT "salaris_perioden_afgerekend_door_fk"
        FOREIGN KEY ("afgerekend_door") REFERENCES "medewerkers"("id") ON DELETE SET NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "salaris_periode_uq"
       ON "salaris_perioden" USING btree ("medewerker_id", "jaar", "maand")`,
    `CREATE INDEX IF NOT EXISTS "salaris_periode_jaar_maand_idx"
       ON "salaris_perioden" USING btree ("jaar", "maand")`,
  ],
};

/**
 * Migratie 0002: zettle_transacties + zettle_sync_state.
 *
 * Analoog aan sumup_transacties: één keer historie backfillen, daarna
 * incrementeel via cron. Maakt de Zettle-reads in dashboard/forecast/AI
 * direct lokaal-snel ipv afhankelijk van de paginated izettle.com API.
 */
const MIGRATIE_0002: Migratie = {
  naam: "0002_zettle_transacties",
  statements: [
    `CREATE TABLE IF NOT EXISTS "zettle_transacties" (
      "id"             serial PRIMARY KEY NOT NULL,
      "bedrijf"        varchar(4) NOT NULL,
      "purchase_uuid"  varchar(64) NOT NULL,
      "bedrag"         numeric(10, 2) NOT NULL,
      "btw_bedrag"     numeric(10, 2) DEFAULT '0',
      "valuta"         varchar(8) DEFAULT 'EUR',
      "refund"         boolean DEFAULT false NOT NULL,
      "timestamp"      timestamp with time zone NOT NULL,
      "producten"      text,
      "created_at"     timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "zettle_tx_bedrijf_uuid_uq"
       ON "zettle_transacties" USING btree ("bedrijf", "purchase_uuid")`,
    `CREATE INDEX IF NOT EXISTS "zettle_tx_bedrijf_ts_idx"
       ON "zettle_transacties" USING btree ("bedrijf", "timestamp")`,
    `CREATE INDEX IF NOT EXISTS "zettle_tx_ts_idx"
       ON "zettle_transacties" USING btree ("timestamp")`,
    `CREATE TABLE IF NOT EXISTS "zettle_sync_state" (
      "bedrijf"          varchar(4) PRIMARY KEY NOT NULL,
      "laatste_sync"     timestamp with time zone NOT NULL,
      "laatste_tx_time"  timestamp with time zone,
      "totaal_gesynct"   integer DEFAULT 0 NOT NULL,
      "laatste_fout"     text
    )`,
  ],
};

/**
 * Migratie 0003: medewerkers.hoofd_department_id.
 *
 * Thuis-vestiging per medewerker — gebruikt voor inleen-doorberekening
 * tussen vestigingen (BB → SL kan zien hoeveel uur Y aan haar werknemers
 * heeft geleend en wat dat kost).
 */
const MIGRATIE_0003: Migratie = {
  naam: "0003_medewerker_hoofd_department",
  statements: [
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "hoofd_department_id" integer
       REFERENCES "departments"("id") ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS "medewerkers_hoofd_dept_idx"
       ON "medewerkers" USING btree ("hoofd_department_id")`,
  ],
};

/**
 * Migratie 0004: gedeelde voorraad (magazijn bij Saté Lounge).
 *
 * Eén productlijst die owner beheert (prijs per eenheid). Andere vestigingen
 * loggen wat ze pakken. Aan het einde van de maand factureert SL het totaal
 * door aan elke afnemende vestiging.
 */
const MIGRATIE_0004: Migratie = {
  naam: "0004_gedeelde_voorraad",
  statements: [
    `CREATE TABLE IF NOT EXISTS "gedeelde_voorraad_producten" (
      "id"                serial PRIMARY KEY NOT NULL,
      "naam"              varchar(80) NOT NULL,
      "categorie"         varchar(40),
      "eenheid"           varchar(20) DEFAULT 'stuk' NOT NULL,
      "prijs_per_eenheid" numeric(8, 2),
      "actief"            boolean DEFAULT true NOT NULL,
      "created_at"        timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "gedeelde_voorraad_afnames" (
      "id"                   serial PRIMARY KEY NOT NULL,
      "product_id"           integer NOT NULL REFERENCES "gedeelde_voorraad_producten"("id") ON DELETE CASCADE,
      "voor_bedrijf"         varchar(4) NOT NULL,
      "aantal"               numeric(8, 2) NOT NULL,
      "datum"                date NOT NULL,
      "door_medewerker_id"   integer REFERENCES "medewerkers"("id") ON DELETE SET NULL,
      "notitie"              text,
      "created_at"           timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "afnames_bedrijf_datum_idx"
       ON "gedeelde_voorraad_afnames" USING btree ("voor_bedrijf", "datum")`,
    `CREATE INDEX IF NOT EXISTS "afnames_product_datum_idx"
       ON "gedeelde_voorraad_afnames" USING btree ("product_id", "datum")`,
  ],
};

/**
 * Migratie 0005: departments.werkgeverslasten_pct.
 *
 * Werkgeverslasten als opslag boven bruto-loon (pensioen + AOF + WW + ZVW +
 * sociaal fonds + opleidingsfonds). Per bedrijf instelbaar; default 27% is
 * horeca-typisch (zie loonjournaal Brunch & Brew mei 2026 → 27,03%).
 */
const MIGRATIE_0005: Migratie = {
  naam: "0005_werkgeverslasten_pct",
  statements: [
    `ALTER TABLE "departments"
       ADD COLUMN IF NOT EXISTS "werkgeverslasten_pct" numeric(5,2) DEFAULT 27.00`,
  ],
};

/**
 * Migratie 0006: departments.huidig_saldo (cashflow-projectie).
 *
 * Owner werkt het saldo handmatig bij; vanaf dat punt rekent de
 * cashflow-projectie vooruit met geplande loon, vaste lasten en
 * omzet-prognose.
 */
const MIGRATIE_0006: Migratie = {
  naam: "0006_huidig_saldo",
  statements: [
    `ALTER TABLE "departments"
       ADD COLUMN IF NOT EXISTS "huidig_saldo" numeric(12,2)`,
    `ALTER TABLE "departments"
       ADD COLUMN IF NOT EXISTS "huidig_saldo_opgeslagen" timestamp with time zone`,
  ],
};

/**
 * Migratie 0007: medewerker zelf-registratie + NAW + loonadministratie.
 *
 * - wachtwoord_hash voor zelf-aanmeld accounts (PIN blijft daily login,
 *   wachtwoord = fallback / account recovery)
 * - NAW velden (adres + geboortedatum)
 * - iban als plain varchar (gevoelig maar geen bijzondere persoonsgegevens)
 * - bsn_versleuteld: AES-256-GCM ciphertext (zie lib/documenten.ts)
 * - onboarding_voltooid: gate voor het portaal — pas na invullen krijg je
 *   roosterzicht
 * - medewerker_documenten: foto's van ID + bankpas, versleuteld met
 *   dezelfde key als BSN
 */
const MIGRATIE_0007: Migratie = {
  naam: "0007_medewerker_zelfregistratie",
  statements: [
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "wachtwoord_hash" text`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "geboortedatum" date`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "straat" varchar(120)`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "huisnummer" varchar(16)`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "postcode" varchar(12)`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "woonplaats" varchar(100)`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "iban" varchar(34)`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "bsn_versleuteld" text`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "onboarding_voltooid" boolean NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS "medewerker_documenten" (
       "id" serial PRIMARY KEY,
       "medewerker_id" integer NOT NULL REFERENCES "medewerkers"("id") ON DELETE CASCADE,
       "type" varchar(32) NOT NULL,
       "mimetype" varchar(64) NOT NULL,
       "bestandsnaam" varchar(200),
       "iv" text NOT NULL,
       "authtag" text NOT NULL,
       "ciphertext" text NOT NULL,
       "grootte_bytes" integer NOT NULL,
       "geupload_op" timestamp with time zone NOT NULL DEFAULT now(),
       "goedgekeurd" boolean NOT NULL DEFAULT false,
       "goedgekeurd_door" varchar(80),
       "goedgekeurd_op" timestamp with time zone
     )`,
    `CREATE INDEX IF NOT EXISTS "medewerker_documenten_medewerker_idx"
       ON "medewerker_documenten" ("medewerker_id")`,
  ],
};

/**
 * Migratie 0008: medewerker goedkeuringsstatus.
 *
 * Pas na owner-approval mag een medewerker rooster/uren/beschikbaarheid
 * zien. Tot die tijd staat 'ie op /m/wachten met een welkomstboodschap.
 */
const MIGRATIE_0008: Migratie = {
  naam: "0008_medewerker_goedkeuring",
  statements: [
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "goedgekeurd" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "goedgekeurd_op" timestamp with time zone`,
    `ALTER TABLE "medewerkers"
       ADD COLUMN IF NOT EXISTS "goedgekeurd_door" varchar(80)`,
    // Bestaande medewerkers (vóór deze migratie) zijn impliciet goedgekeurd
    // — die zijn handmatig door owner aangemaakt en hebben al rooster-data.
    // Alleen NIEUWE zelf-registranten beginnen op false.
    `UPDATE "medewerkers" SET "goedgekeurd" = true WHERE "wachtwoord_hash" IS NULL`,
  ],
};

/**
 * Migratie 0009: feedback_reviews voor klant-feedback flow + leaderboard
 * attributie per dag.
 */
const MIGRATIE_0009: Migratie = {
  naam: "0009_feedback_reviews",
  statements: [
    `CREATE TABLE IF NOT EXISTS "feedback_reviews" (
       "id"            serial PRIMARY KEY,
       "bedrijf_slug"  varchar(8) NOT NULL,
       "datum"         date NOT NULL,
       "sterren"       integer NOT NULL,
       "tekst"         text,
       "ip_hash"       varchar(64),
       "ingediend_op"  timestamptz NOT NULL DEFAULT now(),
       "verborgen"     boolean NOT NULL DEFAULT false
     )`,
    `CREATE INDEX IF NOT EXISTS "feedback_reviews_bedrijf_datum_idx"
       ON "feedback_reviews" ("bedrijf_slug", "datum")`,
    `CREATE INDEX IF NOT EXISTS "feedback_reviews_ingediend_idx"
       ON "feedback_reviews" ("ingediend_op")`,
  ],
};

/**
 * Migratie 0010: review_referrals tabel + review-deeplinks per
 * department. Vervangt de team-attributie via feedback_reviews door
 * persoonlijke QR's per medewerker.
 */
const MIGRATIE_0010: Migratie = {
  naam: "0010_review_referrals",
  statements: [
    `ALTER TABLE "departments"
       ADD COLUMN IF NOT EXISTS "google_review_url" text`,
    `ALTER TABLE "departments"
       ADD COLUMN IF NOT EXISTS "tripadvisor_review_url" text`,
    `CREATE TABLE IF NOT EXISTS "review_referrals" (
       "id"              serial PRIMARY KEY,
       "medewerker_id"   integer NOT NULL REFERENCES "medewerkers"("id") ON DELETE CASCADE,
       "bedrijf_slug"    varchar(8) NOT NULL,
       "datum"           date NOT NULL,
       "status"          varchar(16) NOT NULL DEFAULT 'scan',
       "ip_hash"         varchar(64),
       "user_agent"      varchar(200),
       "geregistreerd_op" timestamptz NOT NULL DEFAULT now()
     )`,
    `CREATE INDEX IF NOT EXISTS "review_referrals_medewerker_datum_idx"
       ON "review_referrals" ("medewerker_id", "datum")`,
    `CREATE INDEX IF NOT EXISTS "review_referrals_bedrijf_datum_idx"
       ON "review_referrals" ("bedrijf_slug", "datum")`,
    `CREATE INDEX IF NOT EXISTS "review_referrals_recent_idx"
       ON "review_referrals" ("geregistreerd_op")`,
  ],
};

const ALLE_MIGRATIES: Migratie[] = [
  MIGRATIE_0001, MIGRATIE_0002, MIGRATIE_0003, MIGRATIE_0004,
  MIGRATIE_0005, MIGRATIE_0006, MIGRATIE_0007, MIGRATIE_0008,
  MIGRATIE_0009, MIGRATIE_0010,
];

async function voerMigratieUit(m: Migratie): Promise<DbInitResultaat> {
  const start = Date.now();
  for (const stmt of m.statements) {
    await db.execute(sql.raw(stmt));
  }
  return {
    naam: m.naam,
    statementsUitgevoerd: m.statements.length,
    duurMs: Date.now() - start,
  };
}

/**
 * Run alle pending migraties. Idempotent — kan veilig meerdere keren
 * worden aangeroepen.
 */
export async function runAllePendingMigraties(): Promise<DbInitResultaat[]> {
  const resultaten: DbInitResultaat[] = [];
  for (const m of ALLE_MIGRATIES) {
    resultaten.push(await voerMigratieUit(m));
  }
  return resultaten;
}
