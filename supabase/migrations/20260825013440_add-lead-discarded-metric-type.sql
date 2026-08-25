-- SPEC 40 E2/DA2 — dois valores novos em `PublicFormMetricType`, numa migration só.
--
-- `lead_discarded`: submissão completa que o gate recusou (motivo em
-- `origin.reason`). `form_submit_failed`: falha de envio no renderer, emitida
-- pela SPEC 41 — entra aqui para não gerar uma segunda migration de enum.
--
-- O SQL gerado pelo `supabase db diff` foi SUBSTITUÍDO de propósito. Ele
-- propunha renomear o tipo, recriá-lo e reescrever a coluna:
--
--   alter table ... alter column eventType type "public"."PublicFormMetricType"
--     using eventType::text::"public"."PublicFormMetricType";
--
-- que quebraria no replay — `eventType` sem aspas é dobrado para `eventtype`, e
-- a coluna é camelCase — além de reescrever a tabela inteira e derrubar
-- qualquer dependência do tipo. Acrescentar valor a enum é `ADD VALUE`, que é
-- idempotente com `IF NOT EXISTS` e não toca nas linhas existentes.
--
-- Nenhum destes valores é usado nesta mesma migration (restrição do Postgres
-- para valor de enum recém-criado dentro da transação).

alter type "public"."PublicFormMetricType" add value if not exists 'lead_discarded';

alter type "public"."PublicFormMetricType" add value if not exists 'form_submit_failed';
