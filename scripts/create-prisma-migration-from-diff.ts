/**
 * @deprecated Use `bun run db:migrate:from-prisma -- <name>` instead.
 * This script wrote to prisma/migrations/ which is no longer the source of truth.
 */

console.error("❌ Este script foi descontinuado.");
console.error("");
console.error("Use o fluxo Supabase + Prisma:");
console.error("  bun run db:migrate:from-prisma -- <migration-name>");
console.error("  bun run db:migrate:from-prisma -- --dry-run <migration-name>");
console.error("");
console.error("Para SQL manual (RLS, seeds, triggers): bun run db:migrate:new <name>");
process.exit(1);
