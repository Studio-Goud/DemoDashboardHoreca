# Database Setup — Sprint 3

Eenmalige stappen om de eigen Postgres-database aan te zetten zodat we
weg kunnen van Shiftbase als data-bron.

## Stap 1 — Vercel Postgres aanzetten (5 minuten)

1. Open [vercel.com/dashboard](https://vercel.com/dashboard) en kies dit project (`omzetoverzicht-bb-sate`)
2. Klik **Storage** → **Create Database**
3. Kies **Postgres** → naam: `studio-goud-db` → regio: **Frankfurt (fra1)**
4. Klik **Create & Continue** → koppel aan dit project (alle environments: Production / Preview / Development)
5. Vercel zet automatisch de env-vars: `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, etc.

## Stap 2 — Lokale env-vars

Trek de env-vars binnen op je laptop:

```bash
cd "Omzetoverzicht-BB-SATE"
npx vercel link            # eenmalig: koppel folder aan Vercel project
npx vercel env pull .env.local
```

`.env.local` heeft nu een `POSTGRES_URL` regel.

## Stap 3 — Schema naar de database pushen

```bash
npm run db:push
```

Dit maakt alle tabellen aan: `departments`, `medewerkers`, `rosters`,
`beschikbaarheid`, `klok_events`, `shift_templates`, `medewerker_departments`,
`sessies`.

## Stap 4 — Data overzetten uit Shiftbase

```bash
npm run migrate:shiftbase
```

Dit synct:
- 3 departments (BB, SL, KL)
- Alle medewerkers + hun team-koppelingen
- Alle shift-templates
- Rosters van laatste 6 maanden + komende 3 maanden
- Beschikbaarheid voor komende 60 dagen

Idempotent: kan opnieuw gedraaid worden om updates over te halen.

## Stap 5 — Visuele check (optioneel)

```bash
npm run db:studio
```

Opent Drizzle Studio in de browser (`https://local.drizzle.studio`).
Hier kun je bladeren door alle tabellen en data inzien.

## Stap 6 — Resend voor e-mail (later, Sprint 5)

Voor de medewerker-registratie via e-mail:

1. Maak gratis account op [resend.com](https://resend.com) (3000 mails/mnd gratis)
2. Verifieer een domein (bv. `studiogoud.nl`) — toevoegen DNS records
3. Maak een API key aan
4. Voeg toe aan Vercel env vars: `RESEND_API_KEY`
5. Voeg toe aan Vercel env vars: `MAIL_FROM` (bv. `rooster@studiogoud.nl`)

Dit hoeft pas in Sprint 5 (medewerker-app). Voor Sprint 4 (refactor) nog niet nodig.

## Wat we nu hebben

Schema klaar, data migrerend, maar de **applicatie gebruikt nog steeds Shiftbase**.
In Sprint 4 vervangen we `lib/shiftbase.ts` door `lib/rooster.ts` die naar Postgres
leest/schrijft. Vanaf dat moment kan Shiftbase officieel opgezegd worden zodra
medewerker-app (Sprint 5) klaar is.
