-- Achado Codex (PR #1137, P1, round 9): o preflight de
-- findActiveByManagerAndEmail (round 8) fecha a janela de duas checkouts
-- pendentes SEQUENCIAIS para o mesmo e-mail, mas não é atômico — duas
-- requisições concorrentes podem as duas observar "nenhum checkout ativo"
-- antes de qualquer INSERT, reabrindo o double-increment/no-second-operator
-- (achado round 6). Índice único parcial fecha a invariante no banco:
-- só pode existir UMA linha "ainda não processada" (operatorCreated = false)
-- por (managerId, email normalizado) — insert concorrente vira violação de
-- unicidade, tratada como erro amigável em CheckoutAsaasUseCase.
-- Achado Codex/cursor[bot] (PR #1137, P1/P2, round 11): a aplicação já
-- considera uma linha "ainda não processada" (operatorCreated = false)
-- abandonada depois de 24h (PENDING_OPERATOR_CHECKOUT_TTL_MS em
-- CheckoutAsaasUseCase.ts) e a partir desta mudança remove essa linha ao
-- liberar um novo checkout — mas um índice único parcial não pode
-- expressar TTL no predicado (now()/current_timestamp não são IMMUTABLE,
-- o Postgres rejeita no WHERE de um índice). Sem este backfill, linhas
-- abandonadas já existentes no momento em que esta migration roda podiam
-- colidir entre si e fazer o CREATE UNIQUE INDEX abaixo falhar. Mesmo
-- critério de expiração que a aplicação já usa.
delete from "public"."corretor_studio_pending_operators"
where "operatorCreated" = false
  and "createdAt" < now() - interval '24 hours';

create unique index if not exists corretor_studio_pending_operators_active_manager_email_key
on "public"."corretor_studio_pending_operators" ("managerId", lower("email"))
where "operatorCreated" = false;
