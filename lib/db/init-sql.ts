/**
 * Voert idempotente DB-migratie SQL uit tegen de live Postgres.
 *
 * Gebruikt voor het aanmaken van nieuwe tabellen (audit_log, salaris_perioden)
 * op productie — vervangt `npm run db:push` voor situaties waar de gebruiker
 * geen shell-toegang heeft (bv. vanaf iPhone).
 *
 * Idempotent: alle statements gebruiken CREATE TABLE IF NOT EXISTS /
 * CREATE INDEX IF NOT EXISTS, dus meerdere keren draaien is veilig.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./client";

export interface DbInitResultaat {
  bestand: string;
  statementsUitgevoerd: number;
  duurMs: number;
}

/**
 * Splits SQL op in losse statements. Drizzle's --> statement-breakpoint
 * commentaar is de canonieke scheider; daarna sluiten we op ;
 */
function splitStatements(sqlText: string): string[] {
  // Verwijder regel-commentaren
  const zonderCommentaar = sqlText
    .split("\n")
    .filter((r) => !r.trim().startsWith("--"))
    .join("\n");

  // Split op '; gevolgd door whitespace/einde'
  return zonderCommentaar
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function voerSqlBestandUit(relPath: string): Promise<DbInitResultaat> {
  const start = Date.now();
  const absPath = join(process.cwd(), relPath);
  const sqlText = readFileSync(absPath, "utf-8");

  const statements = splitStatements(sqlText);
  let uitgevoerd = 0;

  for (const stmt of statements) {
    // Drizzle's sql.raw voor losse statements
    await db.execute(sql.raw(stmt));
    uitgevoerd++;
  }

  return {
    bestand: relPath,
    statementsUitgevoerd: uitgevoerd,
    duurMs: Date.now() - start,
  };
}

/**
 * Run alle pending migration-files in volgorde. Voor nu hard-coded
 * — als we meer migraties krijgen kunnen we drizzle-kit's migration
 * tracking gebruiken (maar dat vereist een aparte __drizzle_migrations table).
 */
export async function runAllePendingMigraties(): Promise<DbInitResultaat[]> {
  const bestanden = [
    "drizzle/0001_audit_log_en_salaris_perioden.sql",
  ];
  const resultaten: DbInitResultaat[] = [];
  for (const b of bestanden) {
    const r = await voerSqlBestandUit(b);
    resultaten.push(r);
  }
  return resultaten;
}
