-- Coorte de pagamento (M12): ASAAS (padrao, comportamento atual) ou ROUTER (PaymentProviderRouter).
-- Backfill ROUTER para contas criadas por adesao paga no router: Profile.subscriptionId iniciando
-- com 'adhesion-' ou 'external-adhesion-' e sem asaasSubscriptionId real (regra de
-- isRealAsaasSubscriptionId em IncrementalBillingService). Idempotente.
-- Rollback: ALTER TABLE "public"."corretor_studio_profile_subscriptions" DROP COLUMN "payment_cohort";

ALTER TABLE "public"."corretor_studio_profile_subscriptions"
  ADD COLUMN IF NOT EXISTS "payment_cohort" TEXT NOT NULL DEFAULT 'ASAAS';

ALTER TABLE "public"."corretor_studio_profile_subscriptions"
  DROP CONSTRAINT IF EXISTS "profile_subscriptions_payment_cohort_check";
ALTER TABLE "public"."corretor_studio_profile_subscriptions"
  ADD CONSTRAINT "profile_subscriptions_payment_cohort_check"
  CHECK ("payment_cohort" IN ('ASAAS', 'ROUTER'));

UPDATE "public"."corretor_studio_profile_subscriptions" ps
SET "payment_cohort" = 'ROUTER'
FROM "public"."corretor_studio_profiles" p
WHERE ps."profileId" = p."id"
  AND ps."payment_cohort" = 'ASAAS'
  AND (p."subscriptionId" LIKE 'adhesion-%' OR p."subscriptionId" LIKE 'external-adhesion-%')
  AND (
    p."asaasSubscriptionId" IS NULL
    OR p."asaasSubscriptionId" LIKE 'adhesion-%'
    OR p."asaasSubscriptionId" LIKE 'external-adhesion-%'
  )
  AND (
    ps."asaasSubscriptionId" IS NULL
    OR ps."asaasSubscriptionId" LIKE 'adhesion-%'
    OR ps."asaasSubscriptionId" LIKE 'external-adhesion-%'
  )
  -- Adesao parcelada com cobrancas so no installmentLedger (sem asaasPaymentId) continua Asaas:
  -- parcela ASAAS pendente, ou paga com cobranca Asaas real (mesma regra de cohortForPaidAdhesion).
  AND NOT (
    p."subscriptionId" LIKE 'adhesion-%'
    AND EXISTS (
      SELECT 1
      FROM "public"."backoffice_adhesions" ba,
        LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(ba."installmentLedger") = 'array' THEN ba."installmentLedger" ELSE '[]'::jsonb END
        ) AS entry
      WHERE ba."id" = ps."adhesionId"
        AND COALESCE(entry ->> 'paymentSource', 'ASAAS') <> 'EXTERNAL'
        AND (
          COALESCE(entry ->> 'status', 'pending') <> 'paid'
          OR NULLIF(btrim(COALESCE(entry ->> 'asaasPaymentId', '')), '') IS NOT NULL
        )
    )
  );
