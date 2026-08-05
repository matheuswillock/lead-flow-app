-- Estágio 5 (D13): placeholder — cutover de dados é via script dry-run
-- `scripts/billing/cutover-dry-run.ts` (não aplica mutações sem --apply + auth owner).
-- Esta migration é intencionalmente no-op para rastrear o estágio no histórico.
SELECT 1;
