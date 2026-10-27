// In-process Postgres (PGlite) for e2e tests and local dev without Neon.
// Selected by DATABASE_URL=pglite:<dataDir> (see scripts/e2e-seed.mjs); the
// scheme is never valid in production, so this branch is dead code there.
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Turbopack may load this module once per route chunk; a globalThis singleton
// keeps ONE PGlite per dataDir across all of them (a second instance on the
// same dataDir aborts the wasm runtime).
const globalStore = globalThis as typeof globalThis & {
  __pgliteInstances?: Map<string, NeonHttpDatabase<typeof schema>>;
};
const instances = (globalStore.__pgliteInstances ??= new Map());

export function getPgliteDb(url: string): NeonHttpDatabase<typeof schema> {
  // PGlite needs an absolute dataDir (relative paths make it hand a URL object
  // to fs inside the Next server bundle and crash).
  const raw = url.slice("pglite:".length);
  const dataDir = raw ? resolve(raw) : undefined;
  const key = dataDir ?? ":memory:";
  let db = instances.get(key);
  if (!db) {
    db = drizzlePglite(new PGlite(dataDir), { schema }) as unknown as NeonHttpDatabase<typeof schema>;
    instances.set(key, db);
  }
  return db;
}
