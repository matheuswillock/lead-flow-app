import type { SubscriptionLifecycleEvent } from "@prisma/client";
import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";

export type SubscriptionChangeLogInput = {
  profileId: string;
  source: string;
  actorProfileId?: string | null;
  eventType: SubscriptionLifecycleEvent;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

export function toSubscriptionChangeLogFields(eventType: SubscriptionLifecycleEvent): {
  eventType: SubscriptionLifecycleEvent;
  changeType: string;
} {
  return { eventType, changeType: eventType };
}

export function lifecycleEventFromSubscriptionStatus(
  status: string,
): SubscriptionLifecycleEvent | null {
  if (status === "past_due") return "overdue";
  if (status === "active") return "restored";
  if (status === "suspended") return "reduced";
  if (status === "canceled") return "cut";
  return null;
}

export async function logSubscriptionChange(input: SubscriptionChangeLogInput): Promise<void> {
  const fields = toSubscriptionChangeLogFields(input.eventType);
  try {
    await billingEngineRepository.createChangeLog({
      profile: { connect: { id: input.profileId } },
      source: input.source,
      actor: input.actorProfileId
        ? { connect: { id: input.actorProfileId } }
        : undefined,
      changeType: fields.changeType,
      eventType: fields.eventType,
      before: input.before as object | undefined,
      after: input.after as object | undefined,
      metadata: input.metadata as object | undefined,
    });
  } catch (error) {
    console.error("[logSubscriptionChange] falha ao gravar ChangeLog", {
      profileId: input.profileId,
      eventType: input.eventType,
      error,
    });
  }
}
