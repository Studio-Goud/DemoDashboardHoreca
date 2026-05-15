-- Persoonlijke roterende review-QR per medewerker. Token = HMAC(id+datum).
-- Klant scant Sophie's QR → /r/{token} → log referral + redirect naar
-- Google/TripAdvisor review-URL. Owner zet review-URL's per bedrijf.
ALTER TABLE "departments"
  ADD COLUMN IF NOT EXISTS "google_review_url" text;

ALTER TABLE "departments"
  ADD COLUMN IF NOT EXISTS "tripadvisor_review_url" text;

CREATE TABLE IF NOT EXISTS "review_referrals" (
  "id"              serial PRIMARY KEY,
  "medewerker_id"   integer NOT NULL REFERENCES "medewerkers"("id") ON DELETE CASCADE,
  "bedrijf_slug"    varchar(8) NOT NULL,
  "datum"           date NOT NULL,
  "status"          varchar(16) NOT NULL DEFAULT 'scan',
  "ip_hash"         varchar(64),
  "user_agent"      varchar(200),
  "geregistreerd_op" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_referrals_medewerker_datum_idx"
  ON "review_referrals" ("medewerker_id", "datum");

CREATE INDEX IF NOT EXISTS "review_referrals_bedrijf_datum_idx"
  ON "review_referrals" ("bedrijf_slug", "datum");

CREATE INDEX IF NOT EXISTS "review_referrals_recent_idx"
  ON "review_referrals" ("geregistreerd_op");
