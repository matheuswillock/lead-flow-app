import { defineConfig } from "prisma/config";

/**
 * Prisma CLI config (seed, schema path, datasource for Studio/push).
 * Migration history lives in supabase/migrations/ — use Supabase CLI
 * (`bun run db:migrate:from-prisma` for schema, `db:migrate:new` for manual SQL).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "supabase/migrations",
    seed: "bunx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.DIRECT_URL,
  },
});
