import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./schema";

/**
 * Database client. Gebruikt Vercel Postgres (Neon onder de motorkap).
 *
 * Vereist env var POSTGRES_URL (wordt automatisch gezet door Vercel
 * wanneer je in het Vercel dashboard een Postgres database aanmaakt
 * en aan dit project koppelt).
 *
 * Lokaal: kopieer de POSTGRES_URL uit het Vercel dashboard naar `.env.local`.
 */
export const db = drizzle(sql, { schema });

export { schema };
