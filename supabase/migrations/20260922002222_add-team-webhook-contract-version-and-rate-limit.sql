-- SPEC 10 (Webhook de Entrada — Fundação e Segurança), A-E1/DA7 e A-E3/DA3.
--
-- Nota de revisão do SQL gerado: `supabase db diff` também produziu um
-- rename-dance completo do enum `notification_type` (DROP/CREATE via
-- "__old_version_to_be_dropped"). Esse enum não foi tocado nesta mudança —
-- o schema.prisma já tinha exatamente os mesmos valores antes e depois; a
-- diferença era só ordem de declaração textual no schema, que não afeta
-- nenhuma consulta e não é gerenciada como um `@@map` desta SPEC. Removido
-- do arquivo para a migration ficar restrita ao que esta SPEC realmente
-- muda (armadilha conhecida: "o db:migrate:from-prisma gera DROP de coisas
-- não relacionadas — revisar antes de commitar").

create table "public"."webhooks_inbound_rate_limit_windows" (
    "key" text not null,
    "windowStart" timestamp(6) with time zone not null,
    "count" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
);

alter table "public"."corretor_studio_team_webhooks" add column "contractVersion" integer not null default 1;

CREATE UNIQUE INDEX webhooks_inbound_rate_limit_windows_pkey ON public.webhooks_inbound_rate_limit_windows USING btree (key, "windowStart");

CREATE INDEX "webhooks_inbound_rate_limit_windows_windowStart_idx" ON public.webhooks_inbound_rate_limit_windows USING btree ("windowStart");

alter table "public"."webhooks_inbound_rate_limit_windows" add constraint "webhooks_inbound_rate_limit_windows_pkey" PRIMARY KEY using index "webhooks_inbound_rate_limit_windows_pkey";

-- R10-2 (revisão Opus, Protocolo 96): mesma falha já corrigida em
-- billing_rate_limit_windows (20260910154446) e em
-- corretor_studio_radar_pixel_rate_limits (20260803231624) — tabela
-- server-only sem RLS/revoke fica exposta aos grants padrão do Data API
-- (PostgREST expõe qualquer tabela do schema public a anon/authenticated
-- por padrão). Este limiter só é lido/escrito pelo Prisma no servidor
-- (lib/webhooks/inbound-rate-limit.ts) — nunca pelo cliente.
ALTER TABLE "public"."webhooks_inbound_rate_limit_windows" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."webhooks_inbound_rate_limit_windows" FROM anon;
REVOKE ALL ON TABLE "public"."webhooks_inbound_rate_limit_windows" FROM authenticated;
GRANT ALL ON TABLE "public"."webhooks_inbound_rate_limit_windows" TO service_role;
-- Rate limits: RLS on, no policies — only service-role / server Prisma path.
