-- Klant-feedback per dag, geattribueerd aan het volledige team dat die
-- datum op rooster stond. Geen FK naar medewerkers — attributie gebeurt
-- in de query-laag (zie lib/medewerker-score.ts).
CREATE TABLE IF NOT EXISTS "feedback_reviews" (
  "id"            serial PRIMARY KEY,
  "bedrijf_slug"  varchar(8) NOT NULL,
  "datum"         date NOT NULL,
  "sterren"       integer NOT NULL,
  "tekst"         text,
  "ip_hash"       varchar(64),
  "ingediend_op"  timestamptz NOT NULL DEFAULT now(),
  "verborgen"     boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS "feedback_reviews_bedrijf_datum_idx"
  ON "feedback_reviews" ("bedrijf_slug", "datum");

CREATE INDEX IF NOT EXISTS "feedback_reviews_ingediend_idx"
  ON "feedback_reviews" ("ingediend_op");
