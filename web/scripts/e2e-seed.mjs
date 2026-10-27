// E2E seed: builds a file-backed PGlite database (dataDir), applies every
// migration SQL in db/migrations/, and inserts the preview user + workspace +
// show the e2e flows act as. Run before starting the server with the same
// DATABASE_URL=pglite:<dataDir>. Idempotent: wipes and rebuilds the dataDir.
import { rmSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const dataDir = (process.env.DATABASE_URL ?? "").replace(/^pglite:/, "");
if (!dataDir) {
  console.error("e2e-seed: set DATABASE_URL=pglite:<dir>");
  process.exit(1);
}
rmSync(resolve(dataDir), { recursive: true, force: true });
const db = new PGlite(resolve(dataDir));

const migrationsDir = resolve("db/migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const sql = readFileSync(join(migrationsDir, f), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) {
    const s = stmt.trim();
    if (s) await db.exec(s);
  }
  console.log("applied", f);
}

await db.exec(`
  insert into users (id, email, name) values ('user_preview', 'preview@example.com', 'Preview User');
  insert into workspaces (id, owner_id, plan) values ('11111111-1111-1111-1111-111111111111', 'user_preview', 'free');
  insert into shows (id, workspace_id, name) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'The Focus Hour');
`);

console.log("e2e seed complete:", dataDir);
process.exit(0);
