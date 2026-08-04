-- Cancela pending action indevida de add_member (Nathiele Willock → William Santos Cruz).
-- Contexto: pending-action-905a72a0-c219-4640-b5c4-eaedca8ecb11 (R$ 39,80 / PIX).
--
-- Pré-condições validadas no remoto antes desta migration (SELECT one-shot):
--   - "paymentId" IS NULL
--   - "checkoutId" IS NULL
-- Não havia vínculo Asaas no registro; a cobrança PIX no Asaas já havia sido
-- cancelada manualmente pelo time. Esta migration NÃO chama Asaas (SQL one-shot
-- de dados). Cancelamento remoto de cobrança com paymentId presente fica no
-- runtime: BackofficePlatformUsersUseCase.deleteMasterUserInvoice →
-- cancelOpenAsaasPayment.
--
-- Idempotente: só altera se ainda estiver pending/failed E paymentId já for NULL.
-- Se paymentId estiver preenchido, o UPDATE não aplica (evita apagar linkage
-- sem cleanup no Asaas).

UPDATE "public"."corretor_studio_pending_actions"
SET
  "status" = 'canceled'::"pending_action_status",
  "paymentId" = NULL,
  "updatedAt" = now()
WHERE "id" = '905a72a0-c219-4640-b5c4-eaedca8ecb11'::uuid
  AND "masterId" = '5d23e96c-b44d-4d90-9192-9478f824c492'::uuid
  AND "actionType" = 'add_member'::"pending_action_type"
  AND "status" IN (
    'pending'::"pending_action_status",
    'failed'::"pending_action_status"
  )
  AND "paymentId" IS NULL
  AND COALESCE(payload->>'profileEmail', '') = 'nathielewillock@gmail.com';
