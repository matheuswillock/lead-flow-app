-- Achado da revisão (codex, P2) — 30 — Migração de Conta (execução) E3.
-- `backoffice_clients.asaasCustomerId` continuava UNIQUE global depois de
-- ganhar a coluna de conta. Durante a janela dual o mesmo `cus_` pode
-- existir nas duas contas (C33): com o unique global, gravar o par legado e
-- o par novo quebraria por constraint. A unicidade real é o par
-- (asaasCustomerId, asaasAccount) — exatamente o tratamento que
-- `backoffice_payments.asaasPaymentId` já recebeu em
-- 20260910154449_add-platform-purchase-asaas-account.sql.
--
-- REVISÃO DO SQL GERADO (regra de agents.md): o `supabase db diff` também
-- emitiu `drop trigger trg_protect_asaas_account_migration_snapshot` e
-- `drop function protect_asaas_account_migration_snapshot()`. Esses dois
-- objetos são da migration manual
-- 20260918010237_protect-asaas-account-migrations-ledger.sql (proteção S4 do
-- ledger, DA2/C3) e o diff só quis removê-los porque o schema.prisma não
-- descreve trigger/função — não porque a intenção fosse removê-los. Os dois
-- statements foram REMOVIDOS deste arquivo à mão; mantê-los desarmaria a
-- proteção append-only do ledger no próximo replay.

drop index if exists "public"."backoffice_clients_asaasCustomerId_key";

CREATE UNIQUE INDEX backoffice_clients_asaas_customer_account_key ON public.backoffice_clients USING btree ("asaasCustomerId", "asaasAccount");
