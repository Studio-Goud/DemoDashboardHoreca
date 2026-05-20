import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    if (DEMO_MODE) {
      // In demo mode geven we een dummy URL terug. DB-calls mogen nooit
      // daadwerkelijk uitgevoerd worden (alle routes checken DEMO_MODE eerst).
      return "postgresql://demo:demo@localhost:5432/demo";
    }
    throw new Error(
      "DATABASE_URL ontbreekt. Run `npx vercel env pull .env.local` om de Neon-URL binnen te halen.",
    );
  }
  return url;
}

const sql = neon(getConnectionString());
export const db = drizzle(sql, { schema });

export { schema };
