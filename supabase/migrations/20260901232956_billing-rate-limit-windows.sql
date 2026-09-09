create table "public"."billing_rate_limit_windows" (
    "key" text not null,
    "windowStart" timestamp(6) with time zone not null,
    "count" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

CREATE UNIQUE INDEX billing_rate_limit_windows_pkey ON public.billing_rate_limit_windows USING btree (key, "windowStart");

alter table "public"."billing_rate_limit_windows" add constraint "billing_rate_limit_windows_pkey" PRIMARY KEY using index "billing_rate_limit_windows_pkey";

-- Achado cursor[bot]/codex no PR #1134: tabela server-only sem RLS/revoke
-- ficava exposta aos grants padrão do Data API. Mesmo padrão de
-- corretor_studio_radar_pixel_rate_limits (20260803231624).
ALTER TABLE "public"."billing_rate_limit_windows" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."billing_rate_limit_windows" FROM anon;
REVOKE ALL ON TABLE "public"."billing_rate_limit_windows" FROM authenticated;
GRANT ALL ON TABLE "public"."billing_rate_limit_windows" TO service_role;
-- Rate limits: RLS on, no policies — only service-role / server Prisma path.

-- Achado codex no PR #1134 (P2): sem retenção, a tabela cresce sem limite
-- (chave inclui IP influenciado por atacante). O limiter faz limpeza
-- oportunista de janelas expiradas a cada consumo (lib/billing/
-- billing-rate-limit.ts); este índice suporta o DELETE por expiração.
CREATE INDEX IF NOT EXISTS "billing_rate_limit_windows_windowStart_idx"
  ON "public"."billing_rate_limit_windows" USING btree ("windowStart");
