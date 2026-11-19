import {
  createAbacatePayProvider,
  createPaymentProviderRouter,
  resolvePaymentProviderEnvironment,
} from "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition";
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository";
import type { PaymentProviderOwnerType } from "@/lib/payment-provider/owner-types";

export type RoutedChargeCustomer = {
  readonly name: string;
  readonly email: string;
  readonly taxId: string;
  readonly cellphone: string;
};

export type RoutedChargeInput = {
  readonly ownerType: PaymentProviderOwnerType;
  readonly ownerId: string;
  readonly tenantId: string;
  readonly idempotencyKey: string;
  readonly routeVersion: string;
  readonly billingType: "PIX" | "CREDIT_CARD";
  readonly amountInCents: number;
  readonly externalReference: string;
  readonly customer: RoutedChargeCustomer;
  readonly metadata: Record<string, string>;
  readonly cardToken?: string;
  readonly installments?: number;
};

/**
 * Cria uma cobrança no provedor roteado (sessão, tentativa, lease e resultado) para qualquer dono.
 * O chamador decide o que fazer com a tentativa (ex.: registrar no PendingAction).
 */
export async function createRoutedProviderCharge(input: RoutedChargeInput) {
  if (input.billingType === "CREDIT_CARD" && !input.cardToken) {
    throw new Error("Token do cartão ausente: o checkout precisa tokenizar o cartão antes de cobrar");
  }

  const environment = resolvePaymentProviderEnvironment();
  const router = await createPaymentProviderRouter(environment);
  const capability = input.billingType === "PIX" ? "PIX" : "CARD";
  const selected = await router.select({
    environment,
    requiredCapabilities: ["ONE_TIME_PAYMENT", capability],
  });

  const provider = await createAbacatePayProvider(environment, selected.externalAccountContext);
  const session = await paymentProviderSessionRepository.createSession({
    tenantId: input.tenantId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    idempotencyKey: input.idempotencyKey,
    provider: selected.provider,
    environment: selected.environment,
    externalAccountContext: selected.externalAccountContext,
    route: "NEW_ROUTER",
    routeVersion: input.routeVersion,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  const attempt = await paymentProviderSessionRepository.createAttempt({
    sessionId: session.id,
    tenantId: input.tenantId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    now: new Date(),
    attemptNumber: 1,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: JSON.stringify({
      amountInCents: input.amountInCents,
      billingType: input.billingType,
      externalReference: input.externalReference,
      installments: input.installments ?? 1,
    }),
    provider: selected.provider,
    environment: selected.environment,
    externalAccountContext: selected.externalAccountContext,
  });

  const leased = await paymentProviderSessionRepository.acquireAttemptLease({
    attemptId: attempt.id,
    tenantId: input.tenantId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    purpose: "PAYMENT",
    now: new Date(),
    ttlMs: 60_000,
  });
  // Achado Codex (PR #1407): PENDING já foi aceita pelo provedor (corrida ou retry); cobrar de novo duplica a cobrança.
  if (leased.status !== "CREATED") {
    throw new Error("Cobrança já enviada ao provedor para esta ação; atualize a página para ver o pagamento");
  }

  const common = {
    amountInCents: input.amountInCents,
    customer: input.customer,
    externalReference: input.externalReference,
    metadata: { ...input.metadata, attemptId: attempt.id },
  };

  const outcome =
    input.billingType === "PIX"
      ? await provider.createPixPayment(common)
      : await provider.createCardPayment({
          ...common,
          token: input.cardToken!,
          tokenIssuedAt: new Date(),
          installments: input.installments ?? 1,
        });

  const updated = await paymentProviderSessionRepository.updateAttemptWithLease({
    attemptId: leased.id,
    tenantId: input.tenantId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    lease: leased.lease,
    now: new Date(),
    status: outcome.status,
    expectedStatus: "CREATED",
    operation: "PAYMENT",
    externalId: "externalId" in outcome ? outcome.externalId : null,
    ...(outcome.status === "PENDING" && "pix" in outcome ? { paymentInstructions: outcome.pix } : {}),
  });

  return { selected, session, attempt: updated, outcome };
}
