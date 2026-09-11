-- Achado P1 do Codex no PR #1138 (20 — Assinaturas — Backend E1): o trigger
-- criado em 20260901233808 (public.prevent_subscription_audit_mutation)
-- bloqueia INCONDICIONALMENTE qualquer UPDATE/DELETE nas duas tabelas de
-- auditoria de assinatura. Isso quebra a deleção de QUALQUER profile que já
-- tenha gerado um SubscriptionChangeLog (praticamente todo profile com
-- histórico de assinatura), porque:
--   - corretor_studio_subscription_change_logs_profileId_fkey tem
--     ON DELETE CASCADE (migration 20260824011709) — apagar o profile
--     dispara um DELETE em cascata nos logs, que o trigger BEFORE DELETE
--     rejeita, abortando a transação inteira de deleção do profile.
--   - corretor_studio_subscription_change_logs_actorProfileId_fkey tem
--     ON DELETE SET NULL — apagar um profile referenciado como ator dispara
--     um UPDATE ... SET "actorProfileId" = NULL, que o trigger BEFORE
--     UPDATE também rejeita pelo mesmo motivo.
--
-- Essas duas ações de FK são cleanup legítimo de um profile (decisão
-- arquitetural anterior a este PR, migration 20260824011709) — não é
-- adulteração de histórico, que é o único cenário que o trigger deve
-- bloquear (S4, achado C3 da auditoria).
--
-- Correção: distinguir a mutação disparada PELA ação de FK (cascade/set
-- null) de uma mutação direta feita por app/SQL Editor, usando
-- pg_trigger_depth(). Uma ação referencial de FK do Postgres é executada a
-- partir de um contexto de trigger interno — quando ela por sua vez dispara
-- o nosso trigger BEFORE UPDATE/DELETE nas tabelas de auditoria, esse
-- trigger nosso roda em profundidade > 1. Uma instrução DIRETA de
-- UPDATE/DELETE emitida pelo app ou por uma sessão SQL Editor roda na
-- tabela de auditoria em profundidade 1 (nenhum trigger a chamando) e
-- continua bloqueada. Não existe, hoje, nenhum outro trigger no codebase
-- que emita UPDATE/DELETE nestas duas tabelas — a única forma de a
-- profundidade ser > 1 é uma ação referencial de FK.
create or replace function public.prevent_subscription_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  raise exception '% is append-only — UPDATE/DELETE are not allowed (S4, 20 — Assinaturas — Backend E1)',
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;
end;
$$;
