/**
 * Eenmalig: geef elke actieve medewerker zonder PIN een tijdelijke default
 * (1234) zodat ze direct kunnen inloggen via /m/login. Na hun eerste login
 * worden ze door de UI naar /m/pin-resetten gestuurd om een eigen 4-cijferige
 * PIN te kiezen (kan niet 1234 blijven; route weigert dat expliciet).
 *
 * Tevens:
 *   - onboarding_voltooid = true  (NAW/IBAN/BSN was al gemigreerd vanuit Shiftbase)
 *   - goedgekeurd         = true  (oude personeelsleden zijn impliciet goedgekeurd)
 *   - moet_pin_resetten   = true  (UI-vlag voor de force-reset)
 *
 * Idempotent: target is `actief=true AND pin_hash IS NULL`. Wie al een eigen
 * PIN heeft wordt nooit aangeraakt, ook niet bij meerdere runs.
 *
 * Gebruik:
 *   npm run seed:default-pin              # dry-run (default — laat zien wat zou gebeuren)
 *   npm run seed:default-pin -- --doe     # echte uitvoering
 *   npm run seed:default-pin -- --doe --pin 9876   # andere default-PIN
 *
 * Vereist .env.local met DATABASE_URL (Neon connection string).
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { eq, and, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "../lib/db/client";
import { runAllePendingMigraties } from "../lib/db/init-sql";

interface Argumenten {
  doe: boolean;
  pin: string;
}

function parseArgs(): Argumenten {
  const args = process.argv.slice(2);
  const doe = args.includes("--doe");
  const pinIdx = args.indexOf("--pin");
  const pin = pinIdx >= 0 ? args[pinIdx + 1] : "1234";
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error(`PIN moet 4-6 cijfers zijn, kreeg: ${pin}`);
  }
  return { doe, pin };
}

async function main() {
  const { doe, pin } = parseArgs();

  console.log("→ DB-migraties uitvoeren (idempotent)…");
  const migr = await runAllePendingMigraties();
  console.log(`   ${migr.length} migraties klaar (laatste: ${migr[migr.length - 1]?.naam})`);

  console.log(`→ Kandidaten zoeken: actief=true EN pin_hash IS NULL`);
  const kandidaten = await db
    .select({
      id: schema.medewerkers.id,
      voornaam: schema.medewerkers.voornaam,
      achternaam: schema.medewerkers.achternaam,
      email: schema.medewerkers.email,
      onboardingVoltooid: schema.medewerkers.onboardingVoltooid,
      goedgekeurd: schema.medewerkers.goedgekeurd,
    })
    .from(schema.medewerkers)
    .where(and(
      eq(schema.medewerkers.actief, true),
      isNull(schema.medewerkers.pinHash),
    ));

  console.log(`   Gevonden: ${kandidaten.length} medewerkers`);
  if (kandidaten.length === 0) {
    console.log("\nNiemand om te seeden — klaar.");
    return;
  }

  console.log("");
  for (const m of kandidaten) {
    const onboarded = m.onboardingVoltooid ? "✓" : "→ true";
    const goed     = m.goedgekeurd ? "✓" : "→ true";
    console.log(
      `   ${String(m.id).padStart(4, " ")} ${(m.voornaam + " " + m.achternaam).padEnd(28, " ")} ${m.email.padEnd(40, " ")} onboarded=${onboarded.padEnd(7, " ")} goedgekeurd=${goed}`,
    );
  }

  if (!doe) {
    console.log("");
    console.log(`Dry-run. Voeg --doe toe om daadwerkelijk uit te voeren.`);
    console.log(`Default-PIN die gezet zou worden: "${pin}"`);
    return;
  }

  console.log("");
  console.log(`→ pin_hash = bcrypt("${pin}") + flags zetten voor ${kandidaten.length} medewerkers…`);
  const hash = await bcrypt.hash(pin, 10);

  // Eén UPDATE met IN-list zodat we niet N round-trips doen.
  const ids = kandidaten.map((k) => k.id);
  await db
    .update(schema.medewerkers)
    .set({
      pinHash: hash,
      moetPinResetten: true,
      onboardingVoltooid: true,
      goedgekeurd: true,
      goedgekeurdOp: new Date(),
      goedgekeurdDoor: "bulk-seed",
      updatedAt: new Date(),
    })
    .where(sql`${schema.medewerkers.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);

  console.log(`   ✓ Bijgewerkt`);
  console.log("");
  console.log("Klaar! Elke medewerker kan nu inloggen op /m/login:");
  console.log(`  - e-mail: zoals in de tabel`);
  console.log(`  - PIN:    ${pin}`);
  console.log(`  - daarna: gedwongen scherm om een eigen PIN te kiezen + Face ID prompt`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n❌ Seed mislukt:", e);
    process.exit(1);
  });
