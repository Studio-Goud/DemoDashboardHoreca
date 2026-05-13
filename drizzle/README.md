# Database-migraties

Drizzle-kit beheert het schema (`lib/db/schema.ts` is de bron van waarheid).
SQL-files in deze map zijn idempotente migraties die op een bestaande
productie-DB gedraaid kunnen worden — bv. via de Neon SQL-editor of `psql`.

## Workflow

### Optie 1 — automatisch (aanrader voor development)

```bash
npm run db:push
```

Dit synchroniseert `lib/db/schema.ts` direct met de live DB zonder een
migratie-file. Drizzle bepaalt zelf welke `CREATE TABLE` / `ALTER TABLE`
statements er nodig zijn.

### Optie 2 — handmatig (voor productie als je controle wilt)

1. Open Neon SQL-editor of verbind met `psql $DATABASE_URL`
2. Plak/draai de migratie-file vanuit deze map
3. Alle migraties gebruiken `CREATE TABLE IF NOT EXISTS` dus meerdere keren
   draaien doet geen kwaad

## Migratie-historie

| Bestand | PR | Wat het doet |
|---|---|---|
| `0001_audit_log_en_salaris_perioden.sql` | #5 + #6 | Voegt `audit_log` (onveranderlijke wijzigingslog) en `salaris_perioden` (maandbedragen + status) toe. |

## Bestaande tabellen (niet meer migreerbaar via SQL-files)

De volgende 12 tabellen stonden al in productie vóór de SQL-migratie-systematiek
werd ingevoerd. Zij worden beheerd via `db:push`:

departments · medewerkers · medewerker_departments · shift_templates ·
rosters · beschikbaarheid · klok_events · sessies · sumup_transacties ·
sumup_sync_state · voorraad_producten · voorraad_status
