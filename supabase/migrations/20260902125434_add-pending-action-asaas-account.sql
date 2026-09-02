alter table "public"."corretor_studio_pending_actions" add column "asaasAccount" public.asaas_account not null default 'primary'::public.asaas_account;

-- Backfill: linhas criadas antes do cutover de produção (flip de conta Asaas
-- em 2026-08-31 23:25 UTC, ver 20260831232456_flip-pre-cutover-legacy.sql)
-- tinham seu paymentId nascido na conta legacy, não na primary do @default.
do $$
declare
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  update "public"."corretor_studio_pending_actions"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "paymentId" is not null
    and "createdAt" < cutover_at;
end $$;
