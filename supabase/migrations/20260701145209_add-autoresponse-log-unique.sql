-- Garante que a mesma mensagem inbound nao possa disparar a mesma regra de
-- auto-resposta mais de uma vez, fechando a corrida onde webhooks concorrentes
-- (redelivery ou race no ProcessEvoWebhookUseCase) geram duas respostas
-- automaticas para a mesma (conversationId, ruleType, inboundMessageId).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_auto_response_logs_conv_rule_inbound_key'
  ) THEN
    ALTER TABLE "public"."whatsapp_auto_response_logs"
      ADD CONSTRAINT "whatsapp_auto_response_logs_conv_rule_inbound_key"
      UNIQUE ("conversationId", "ruleType", "inboundMessageId");
  END IF;
END $$;
