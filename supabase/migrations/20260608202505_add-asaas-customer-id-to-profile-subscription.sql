-- Adiciona asaasCustomerId em ProfileSubscription (centralização de assinatura).
-- IF NOT EXISTS: a coluna já existe no remoto (aplicada via prisma db push por engano);
-- esta migration apenas reconcilia o histórico, sem reaplicar a alteração.
ALTER TABLE "public"."corretor_studio_profile_subscriptions"
  ADD COLUMN IF NOT EXISTS "asaasCustomerId" text;
