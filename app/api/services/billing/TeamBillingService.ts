import { billingRepository } from "@/app/api/infra/data/repositories/billing/BillingRepository";
import type { BillingSnapshot } from "@/app/api/infra/data/repositories/billing/IBillingRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";

export { BILLING_PRICES };

export function buildBillingSummary(masterId: string, snapshot: BillingSnapshot): BillingSummary {
  const rawExtraTeams = Math.max(0, snapshot.teamCount - 1);
  const rawExtraUsers = Math.max(0, snapshot.totalUsersIncludingMaster - 1);
  const includedExtraTeams = Math.max(0, snapshot.includedExtraTeams);
  const includedExtraUsers = Math.max(0, snapshot.includedExtraUsers);
  const availableExtraTeams = Math.max(0, includedExtraTeams - rawExtraTeams);
  const availableExtraUsers = Math.max(0, includedExtraUsers - rawExtraUsers);
  const billableTeams = Math.max(0, rawExtraTeams - includedExtraTeams);
  const billableUsers = Math.max(0, rawExtraUsers - includedExtraUsers);

  const basePrice = BILLING_PRICES.base;
  const extraTeamsPrice = billableTeams * BILLING_PRICES.extraTeam;
  const extraUsersPrice = billableUsers * BILLING_PRICES.extraUser;
  const totalPrice = basePrice + extraTeamsPrice + extraUsersPrice;

  return {
    masterId,
    teamCount: snapshot.teamCount,
    distinctUserCount: snapshot.distinctUserCount,
    totalUsersIncludingMaster: snapshot.totalUsersIncludingMaster,
    includedExtraTeams,
    includedExtraUsers,
    availableExtraTeams,
    availableExtraUsers,
    billableTeams,
    billableUsers,
    basePrice,
    extraTeamsPrice,
    extraUsersPrice,
    totalPrice: snapshot.hasPermanentSubscription ? 0 : Number(totalPrice.toFixed(2)),
    hasPermanentSubscription: snapshot.hasPermanentSubscription,
  };
}

export async function getBillingSummary(masterId: string): Promise<BillingSummary> {
  const snapshot = await billingRepository.getBillingSnapshot(masterId);

  if (!snapshot) {
    throw new Error("Master não encontrado");
  }

  return buildBillingSummary(masterId, snapshot);
}
