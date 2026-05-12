import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Database client. Gebruikt Neon (Postgres) via Vercel.
 *
 * Vereist env var DATABASE_URL (wordt automatisch gezet door de Vercel
 * Neon-integratie). POSTGRES_URL wordt als fallback geaccepteerd voor
 * compat met oudere Vercel Postgres setups.
 *
 * Lokaal: `npx vercel env pull .env.local` zet de juiste vars.
 */
function getConnectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ontbreekt. Run `npx vercel env pull .env.local` om de Neon-URL binnen te halen.",
    );
  }
  return url;
}

const sql = neon(getConnectionString());
export const db = drizzle(sql, { schema });

export { schema };
