-- Migratie: nieuwe tabellen voor audit-log + salaris-administratie.
--
-- Voeg toe aan een bestaande productie-DB die de overige 12 tabellen al heeft.
-- IF NOT EXISTS zorgt dat de migratie idempotent is — meerdere keren draaien
-- doet geen kwaad.
--
-- Draai dit via Neon SQL-editor of psql, of gewoon `npm run db:push` die de
-- wijzigingen automatisch toepast vanuit lib/db/schema.ts.
--
-- Bij PR #5 (audit-log) en PR #6 (salaris) toegevoegd aan het schema.

-- ─── Audit-log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_log" (
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
);

CREATE INDEX IF NOT EXISTS "audit_log_entiteit_idx"
  ON "audit_log" USING btree ("entiteit", "entiteit_id");
CREATE INDEX IF NOT EXISTS "audit_log_door_idx"
  ON "audit_log" USING btree ("door_medewerker_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_log_tijd_idx"
  ON "audit_log" USING btree ("created_at");

-- ─── Salaris-perioden ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "salaris_perioden" (
  "id"                    serial PRIMARY KEY NOT NULL,
  "medewerker_id"         integer NOT NULL,
  "jaar"                  integer NOT NULL,
  "maand"                 integer NOT NULL,

  -- Berekening
  "bruto_uren"            numeric(7, 2) NOT NULL,
  "uurloon"               numeric(6, 2) NOT NULL,
  "bruto_loon"            numeric(9, 2) NOT NULL,

  -- Toeslagen
  "vakantiegeld_pct"      numeric(5, 3) NOT NULL,
  "vakantiegeld_eur"      numeric(9, 2) NOT NULL,
  "vakantie_uren_pct"     numeric(5, 3) NOT NULL,
  "vakantie_uren_eur"     numeric(9, 2) NOT NULL,

  -- Eindbedrag
  "totaal_eur"            numeric(9, 2) NOT NULL,

  -- Bron + integriteit
  "bron"                  varchar(16) DEFAULT 'rooster' NOT NULL,
  "bereken_hash"          varchar(64) NOT NULL,

  -- Status-flow
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "salaris_periode_uq"
  ON "salaris_perioden" USING btree ("medewerker_id", "jaar", "maand");
CREATE INDEX IF NOT EXISTS "salaris_periode_jaar_maand_idx"
  ON "salaris_perioden" USING btree ("jaar", "maand");
