-- SPEC 40 — claim atômico de lead-sync por submissão.
--
-- Bug: dois POSTs concorrentes de `/progress` da mesma sessão (blur +
-- page_advanced, ~70ms de distância) chegam ao `upsertLeadFromFormAnswers`
-- antes de qualquer um commitar o `findMatchingLead` (SELECT) — os dois criam
-- lead (TOCTOU). Não existe unique de identidade em `Lead` que cubra isso, e
-- não pode existir: a regra status-aware (PR #1114) permite por design
-- múltiplos leads vivos com a mesma identidade em status diferentes.
--
-- Esta coluna é o claim: `/progress` e o accept compartilham a MESMA linha de
-- `corretor_studio_public_form_submissions`. Antes de criar, o executor
-- reivindica a submissão com um `UPDATE ... WHERE "leadSyncClaimedAt" IS NULL`
-- atômico no banco — sem advisory lock de sessão e sem transação longa
-- envolvendo o create inteiro (pgbouncer transaction-mode não sustenta
-- nenhum dos dois). Quem perde o claim re-resolve e anexa no lead do
-- vencedor; se o vencedor nunca commitar, cria mesmo assim.
ALTER TABLE "public"."corretor_studio_public_form_submissions"
  ADD COLUMN IF NOT EXISTS "leadSyncClaimedAt" timestamptz;
