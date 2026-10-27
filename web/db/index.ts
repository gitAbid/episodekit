import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getPgliteDb } from "./pglite";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | null = null;

/**
 * The documented DB boundary for the app: every DB call goes through getDb().
 * Throws when DATABASE_URL is missing — routes translate that into a clean 503
 * so keyless previews degrade instead of crashing.
 */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See web/.env.example.");
  }
  if (url.startsWith("pglite:")) {
    return getPgliteDb(url);
  }
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}
