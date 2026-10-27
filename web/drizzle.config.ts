import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Only needed for `drizzle-kit migrate/push`; `generate` works keyless.
    url: process.env.DATABASE_URL ?? "",
  },
});
