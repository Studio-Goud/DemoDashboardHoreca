import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Lazy init — neon() wordt NOOIT aangeroepen tijdens module-import.
// Pas op het moment dat db.iets() echt gebruikt wordt.
// In demo mode gooit de proxy een fout (maar dat mag nooit bereikt worden
// want alle routes checken DEMO_MODE al voor de db-aanroep).
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (DEMO_MODE) {
    throw new Error("[demo] DB-aanroep onderschept — controleer DEMO_MODE check in de aanroepende route.");
  }
  if (_db) return _db;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ontbreekt. Run `npx vercel env pull .env.local` om de Neon-URL binnen te halen.",
    );
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

// Proxy zodat `db.select(...)` etc. werken zonder aanpassing in de rest van de code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)[prop];
  },
});

export { schema };
