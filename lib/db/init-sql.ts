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

const ALLE_MIGRATIES: Migratie[] = [MIGRATIE_0001, MIGRATIE_0002, MIGRATIE_0003, MIGRATIE_0004];

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
