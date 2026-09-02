-- Achado Codex (PR #1137, P1, round 9): o preflight de
-- findActiveByManagerAndEmail (round 8) fecha a janela de duas checkouts
-- pendentes SEQUENCIAIS para o mesmo e-mail, mas não é atômico — duas
-- requisições concorrentes podem as duas observar "nenhum checkout ativo"
-- antes de qualquer INSERT, reabrindo o double-increment/no-second-operator
-- (achado round 6). Índice único parcial fecha a invariante no banco:
-- só pode existir UMA linha "ainda não processada" (operatorCreated = false)
-- por (managerId, email normalizado) — insert concorrente vira violação de
-- unicidade, tratada como erro amigável em CheckoutAsaasUseCase.
create unique index if not exists corretor_studio_pending_operators_active_manager_email_key
on "public"."corretor_studio_pending_operators" ("managerId", lower("email"))
where "operatorCreated" = false;
