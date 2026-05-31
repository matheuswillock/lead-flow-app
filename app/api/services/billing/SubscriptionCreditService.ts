import type { Prisma } from "@prisma/client";
import { subscriptionCreditRepository } from "@/app/api/infra/data/repositories/billing/SubscriptionCreditRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";

export interface CreditProjectionInput {
  teams?: number;
  users?: number;
}

export interface CreditProjection {
  currentSummary: BillingSummary;
  addedTeamCredits: number;
  addedUserCredits: number;
  targetRecurringTotal: number;
  billingDelta: number;
}

export interface CreditRemovalInput {
  teams?: number;
  users?: number;
}

export interface CreditRemovalResult {
  summary: BillingSummary;
  targetRecurringTotal: number;
}

const roundCurrency = (value: number) => Number(value.toFixed(2));

function getTargetRecurringTotal(summary: BillingSummary, extraTeams: number, extraUsers: number) {
  if (summary.hasPermanentSubscription) return 0;
  const effectiveExtraUsers = summary.hasUnlimitedUsers ? 0 : extraUsers;

  return roundCurrency(
    summary.basePrice +
      (summary.billableTeams + extraTeams) * BILLING_PRICES.extraTeam +
      (summary.billableUsers + effectiveExtraUsers) * BILLING_PRICES.extraUser
  );
}

export class SubscriptionCreditService {
  async assertCapacityAvailable(
    tx: Prisma.TransactionClient,
    masterId: string,
    input: CreditProjectionInput
  ): Promise<BillingSummary> {
    return subscriptionCreditRepository.assertCapacityAvailable(tx, masterId, input);
  }

  async projectCreditAddition(masterId: string, input: CreditProjectionInput): Promise<CreditProjection> {
    const currentSummary = await subscriptionCreditRepository.getSummary(masterId);
    const addedTeamCredits = Math.max(0, input.teams ?? 0);
    const addedUserCredits = Math.max(0, input.users ?? 0);
    const targetRecurringTotal = getTargetRecurringTotal(currentSummary, addedTeamCredits, addedUserCredits);
    const billingDelta = currentSummary.hasPermanentSubscription
      ? 0
      : roundCurrency(Math.max(0, targetRecurringTotal - currentSummary.totalPrice));

    return {
      currentSummary,
      addedTeamCredits,
      addedUserCredits,
      targetRecurringTotal,
      billingDelta,
    };
  }

  async applyCreditAddition(
    tx: Prisma.TransactionClient,
    masterId: string,
    input: CreditProjectionInput
  ): Promise<BillingSummary> {
    return subscriptionCreditRepository.applyCreditAddition(tx, masterId, input);
  }

  async removeCredits(masterId: string, input: CreditRemovalInput): Promise<CreditRemovalResult> {
    return subscriptionCreditRepository.removeCredits(masterId, input);
  }
}

export const subscriptionCreditService = new SubscriptionCreditService();
