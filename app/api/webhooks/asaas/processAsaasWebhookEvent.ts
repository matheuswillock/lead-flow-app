import { PaymentRepository } from "@/app/api/infra/data/repositories/payment/PaymentRepository";
import type { PaymentValidationResult } from "@/app/api/services/PaymentValidation/IPaymentValidationService";
import type {
  AsaasPayment,
  AsaasSubscription,
} from "@/app/api/services/PaymentValidation/AsaasWebhookTypes";
import { PaymentValidationService } from "@/app/api/services/PaymentValidation/PaymentValidationService";
import { PaymentValidationUseCase } from "@/app/api/useCases/payments/PaymentValidationUseCase";
import { getFullUrl } from "@/lib/utils/app-url";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { invalidateAccountAccessStatusCache } from "@/lib/cache/invalidation";

export type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    externalReference?: string;
    checkoutSession?: string;
    subscription?: string;
    invoiceUrl?: string;
  };
  subscription?: {
    id?: string;
    customer?: string;
    externalReference?: string;
    value?: number;
    nextDueDate?: string;
    cycle?: string;
    status?: string;
  };
};

export function resolveAsaasWebhookEventId(body: AsaasWebhookBody): string {
  const explicitId = typeof body.id === "string" ? body.id.trim() : "";
  if (explicitId) return explicitId;

  const paymentId = body.payment?.id;
  const subscriptionId = body.subscription?.id;
  const event = body.event ?? "unknown";

  if (paymentId) return `${event}:payment:${paymentId}`;
  if (subscriptionId) return `${event}:subscription:${subscriptionId}`;
  return `${event}:${Date.now()}`;
}

function parseBrazilianDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(isoDate);

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function processAsaasWebhookEvent(body: AsaasWebhookBody): Promise<void> {
  const startedAt = Date.now();
  const eventId = resolveAsaasWebhookEventId(body);

  console.info("[AsaasWebhookRoute][process] start", {
    eventId,
    event: body.event,
    paymentId: body.payment?.id ?? null,
    externalReference: body.payment?.externalReference ?? null,
  });

  const hasPayment = !!body.payment;

  if (hasPayment && !body.payment?.id) {
    console.warn("[AsaasWebhookRoute][process] Payment sem ID - ignorando");
    return;
  }

  const paymentRepository = new PaymentRepository();
  const paymentValidationService = new PaymentValidationService(paymentRepository);
  const paymentValidationUseCase = new PaymentValidationUseCase(paymentValidationService);

  const webhookPayload = (hasPayment ? body.payment : body.subscription) as
    | AsaasPayment
    | AsaasSubscription
    | undefined;

  let isPaid = false;

  if (webhookPayload) {
    const paymentValidationOutput = await paymentValidationUseCase.processWebhook({
      event: body.event ?? "",
      payment: webhookPayload,
    });

    const result =
      (paymentValidationOutput.result as PaymentValidationResult | null) ?? null;
    isPaid = result?.isPaid === true;

    console.info("[AsaasWebhookRoute][process] payment validation", {
      eventId,
      isValid: paymentValidationOutput.isValid,
      isPaid,
    });
  } else {
    console.warn("[AsaasWebhookRoute][process] payload sem payment/subscription", { eventId });
  }

  if (body?.payment?.id) {
    const paymentId = body.payment.id;
    const externalReference =
      body.payment.externalReference || body.subscription?.externalReference;
    const paymentStatus = body.payment.status;
    const checkoutSessionId = body.payment.checkoutSession;

    try {
      const { backofficeAdhesionUseCase } = await import(
        "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
      );
      const adhesionOutput = await backofficeAdhesionUseCase.processPaymentWebhook(
        body.event ?? "",
        body.payment,
        { deferEmailDelivery: true }
      );

      console.info("[AsaasWebhookRoute][process][BackofficeAdhesion]", {
        eventId,
        isValid: adhesionOutput.isValid,
        result: adhesionOutput.result,
      });
    } catch (error) {
      rethrowIfPrerenderInterrupted(error);
      console.error("[AsaasWebhookRoute][process][BackofficeAdhesion]", { eventId, error });
    }

    let isOperatorPayment = false;
    let isPendingActionPayment = false;

    if (checkoutSessionId) {
      try {
        const { prisma } = await import("@/app/api/infra/data/prisma");
        const pendingOperator = await prisma.pendingOperator.findFirst({
          where: { paymentId: checkoutSessionId },
        });

        isOperatorPayment = !!pendingOperator;

        const pendingAction = await prisma.pendingAction.findFirst({
          where: { checkoutId: checkoutSessionId, status: "pending" },
        });

        isPendingActionPayment = !!pendingAction;
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] pendingOperator lookup failed", {
          eventId,
          error,
        });
      }
    }

    if (isOperatorPayment && (isPaid || paymentStatus === "CONFIRMED")) {
      try {
        const { checkoutAsaasUseCase } = await import(
          "@/app/api/useCases/subscriptions/CheckoutAsaasUseCase"
        );
        const operatorResult = await checkoutAsaasUseCase.processOperatorCheckoutPaid(
          checkoutSessionId!,
          paymentId
        );

        if (!operatorResult.isValid) {
          console.error("[AsaasWebhookRoute][process] operator checkout failed", {
            eventId,
            errorMessages: operatorResult.errorMessages,
            paymentId,
            externalReference,
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] operator checkout error", { eventId, error });
      }
    }

    if (isPendingActionPayment && (isPaid || paymentStatus === "CONFIRMED")) {
      try {
        const { pendingActionUseCase } = await import(
          "@/app/api/useCases/pendingActions/PendingActionUseCase"
        );
        const actionResult = await pendingActionUseCase.applyPendingActionByCheckout(
          checkoutSessionId!,
          paymentId
        );

        if (!actionResult.isValid) {
          console.error("[AsaasWebhookRoute][process] pending action checkout failed", {
            eventId,
            errorMessages: actionResult.errorMessages,
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] pending action checkout error", {
          eventId,
          error,
        });
      }
    }

    const isPendingActionRef =
      !!externalReference && externalReference.startsWith("pending-action-");
    if (!isPendingActionPayment && isPendingActionRef && (isPaid || paymentStatus === "CONFIRMED")) {
      try {
        const { pendingActionUseCase } = await import(
          "@/app/api/useCases/pendingActions/PendingActionUseCase"
        );
        const actionResult = await pendingActionUseCase.applyPendingActionByPaymentId(paymentId);

        if (!actionResult.isValid) {
          console.error("[AsaasWebhookRoute][process] pending action payment failed", {
            eventId,
            errorMessages: actionResult.errorMessages,
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] pending action payment error", {
          eventId,
          error,
        });
      }
    }

    const isPendingOperatorRef =
      !!externalReference && externalReference.startsWith("pending-operator-");
    if (!isOperatorPayment && isPendingOperatorRef && isPaid) {
      try {
        const { subscriptionUpgradeUseCase } = await import(
          "@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase"
        );
        const operatorResult =
          await subscriptionUpgradeUseCase.confirmPaymentAndCreateOperator(paymentId);

        if (!operatorResult.isValid) {
          console.error("[AsaasWebhookRoute][process] operator externalRef failed", {
            eventId,
            errorMessages: operatorResult.errorMessages,
            paymentId,
            externalReference,
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] operator externalRef error", {
          eventId,
          error,
        });
      }
    }

    const isPlatformPurchaseRef =
      !!externalReference && externalReference.startsWith("platform-purchase-");
    if (isPlatformPurchaseRef && (isPaid || paymentStatus === "CONFIRMED")) {
      try {
        const { platformCheckoutUseCase } = await import(
          "@/app/api/useCases/platformCheckout/PlatformCheckoutUseCase"
        );
        const purchaseResult = await platformCheckoutUseCase.applyPaidPurchase({
          externalReference,
          asaasPaymentId: paymentId,
        });

        if (!purchaseResult.isValid) {
          console.error("[AsaasWebhookRoute][process] platform purchase failed", {
            eventId,
            errorMessages: purchaseResult.errorMessages,
            paymentId,
            externalReference,
          });
        } else {
          console.info("[AsaasWebhookRoute][process] platform purchase applied", {
            eventId,
            paymentId,
            externalReference,
            successMessages: purchaseResult.successMessages,
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] platform purchase error", {
          eventId,
          error,
        });
      }
    }
  }

  if (isPaid && body?.payment?.subscription) {
    try {
      const { checkoutAsaasUseCase } = await import(
        "@/app/api/useCases/subscriptions/CheckoutAsaasUseCase"
      );
      const activationResult = await checkoutAsaasUseCase.processCheckoutPaid(body.payment.id!);

      if (!activationResult.isValid) {
        console.error("[AsaasWebhookRoute][process] subscription activation failed", {
          eventId,
          subscriptionId: body.payment.subscription,
        });
      }
    } catch (error) {
      rethrowIfPrerenderInterrupted(error);
      console.error("[AsaasWebhookRoute][process] subscription activation error", { eventId, error });
    }
  }

  if (body.event === "SUBSCRIPTION_CREATED" || body.event === "SUBSCRIPTION_UPDATED") {
    const subscription = body.subscription;

    if (subscription?.id && subscription?.customer) {
      try {
        const { prisma } = await import("@/app/api/infra/data/prisma");
        const manager = await prisma.profile.findFirst({
          where: {
            asaasCustomerId: subscription.customer,
            role: "manager",
          },
        });

        if (manager) {
          const nextDueDate = parseBrazilianDate(subscription.nextDueDate ?? "");
          const updateData: {
            asaasSubscriptionId: string;
            subscriptionCycle: string;
            subscriptionNextDueDate?: Date;
          } = {
            asaasSubscriptionId: subscription.id,
            subscriptionCycle: subscription.cycle || "MONTHLY",
          };

          if (nextDueDate) {
            updateData.subscriptionNextDueDate = nextDueDate;
          }

          await prisma.profile.update({
            where: { id: manager.id },
            data: updateData,
          });

          invalidateAccountAccessStatusCache({ accountMasterId: manager.id });
        } else {
          console.warn("[AsaasWebhookRoute][process] manager not found", {
            eventId,
            customerId: subscription.customer,
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][process] subscription sync error", { eventId, error });
      }
    }
  }

  const subscriptionStatusChangeEvents = [
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED",
  ];

  if (subscriptionStatusChangeEvents.includes(body.event ?? "") && body.subscription?.customer) {
    try {
      const { prisma } = await import("@/app/api/infra/data/prisma");
      const manager = await prisma.profile.findFirst({
        where: {
          asaasCustomerId: body.subscription.customer,
          role: "manager",
        },
      });

      if (manager) {
        invalidateAccountAccessStatusCache({ accountMasterId: manager.id });
      } else {
        console.warn("[AsaasWebhookRoute][process] manager not found for status invalidation", {
          eventId,
          customerId: body.subscription.customer,
        });
      }
    } catch (error) {
      rethrowIfPrerenderInterrupted(error);
      console.error("[AsaasWebhookRoute][process] subscription status invalidation error", {
        eventId,
        error,
      });
    }
  }

  if (isPaid && body?.payment?.subscription) {
    const subscriptionId = body.payment.subscription;

    try {
      const notifyUrl = getFullUrl(`/api/v1/subscriptions/${subscriptionId}/notify-payment`);

      fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: body.payment.id,
          status: body.payment.status,
          timestamp: Date.now(),
        }),
      }).catch((error) => {
        console.error("[AsaasWebhookRoute][process] frontend notify failed", { eventId, error });
      });
    } catch (error) {
      rethrowIfPrerenderInterrupted(error);
      console.error("[AsaasWebhookRoute][process] frontend notify error", { eventId, error });
    }
  }

  if (
    (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") &&
    body.payment?.id
  ) {
    try {
      const { BackofficePaymentRepository } = await import(
        "@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository"
      );
      const backofficePaymentRepo = new BackofficePaymentRepository();
      const existing = await backofficePaymentRepo.findByAsaasPaymentId(body.payment.id);
      if (existing) {
        await backofficePaymentRepo.updateStatus(existing.id, body.payment.status ?? "", {
          invoiceUrl: body.payment.invoiceUrl ?? existing.invoiceUrl ?? undefined,
        });
      }
    } catch (error) {
      console.error("[AsaasWebhookRoute][process][BackofficePayment]", { eventId, error });
    }
  }

  console.info("[AsaasWebhookRoute][process] done", {
    eventId,
    durationMs: Date.now() - startedAt,
  });
}
