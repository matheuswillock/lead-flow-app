import { billingEngineRepository } from "@/app/api/infra/data/repositories/billing/BillingEngineRepository";

export type SubscriptionChangeLogInput = {
  profileId: string;
  source: string;
  actorProfileId?: string | null;
  changeType: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

export async function logSubscriptionChange(input: SubscriptionChangeLogInput): Promise<void> {
  try {
    await billingEngineRepository.createChangeLog({
      profile: { connect: { id: input.profileId } },
      source: input.source,
      actor: input.actorProfileId
        ? { connect: { id: input.actorProfileId } }
        : undefined,
      changeType: input.changeType,
      before: input.before as object | undefined,
      after: input.after as object | undefined,
      metadata: input.metadata as object | undefined,
    });
  } catch (error) {
    console.error("[logSubscriptionChange] falha ao gravar ChangeLog", {
      profileId: input.profileId,
      changeType: input.changeType,
      error,
    });
  }
}
