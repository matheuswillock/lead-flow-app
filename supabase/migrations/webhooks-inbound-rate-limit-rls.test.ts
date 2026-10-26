import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R10-2 (revisão Opus, Protocolo 96) — `webhooks_inbound_rate_limit_windows`
 * é uma tabela server-only (só lida/escrita pelo Prisma em
 * lib/webhooks/inbound-rate-limit.ts). Sem RLS + REVOKE, o PostgREST do
 * Supabase expõe qualquer tabela do schema `public` a `anon`/`authenticated`
 * por padrão — mesma falha já corrigida em `billing_rate_limit_windows`
 * (20260910154446) e `corretor_studio_radar_pixel_rate_limits`
 * (20260803231624). Este teste falha se a migration recuar para o SQL
 * gerado cru pelo `db:migrate:from-prisma` (sem o bloco de RLS/REVOKE).
 */
const MIGRATION_PATH = join(
  __dirname,
  "20260922002222_add-team-webhook-contract-version-and-rate-limit.sql",
);

describe("migration webhooks_inbound_rate_limit_windows — RLS (R10-2)", () => {
  it("habilita RLS e revoga anon/authenticated na tabela nova", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");

    expect(sql).toContain(
      'ALTER TABLE "public"."webhooks_inbound_rate_limit_windows" ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toContain(
      'REVOKE ALL ON TABLE "public"."webhooks_inbound_rate_limit_windows" FROM anon',
    );
    expect(sql).toContain(
      'REVOKE ALL ON TABLE "public"."webhooks_inbound_rate_limit_windows" FROM authenticated',
    );
    expect(sql).toContain(
      'GRANT ALL ON TABLE "public"."webhooks_inbound_rate_limit_windows" TO service_role',
    );
  });
});
