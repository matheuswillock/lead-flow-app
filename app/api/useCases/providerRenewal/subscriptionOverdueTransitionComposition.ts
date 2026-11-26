import { providerRenewalRepository } from "@/app/api/infra/data/repositories/providerRenewal/ProviderRenewalRepository";
import { BILLING_GRACE_DAYS } from "@/app/api/shared/billing/billingGraceWindow";
import { logSubscriptionChange } from "@/lib/billing/logSubscriptionChange";
import { SubscriptionOverdueTransitionUseCase } from "./SubscriptionOverdueTransitionUseCase";

export function createSubscriptionOverdueTransitionUseCase(): SubscriptionOverdueTransitionUseCase {
  return new SubscriptionOverdueTransitionUseCase({
    source: providerRenewalRepository,
    graceDays: BILLING_GRACE_DAYS,
    recordTransition: (profileId) =>
      logSubscriptionChange({
        profileId,
        source: "SubscriptionOverdueTransitionUseCase",
        changeType: "overdue",
        eventType: "overdue",
        before: { subscriptionStatus: "active" },
        after: { subscriptionStatus: "past_due" },
      }),
  });
}
