import type { BillingSnapshot } from "@/app/api/infra/data/repositories/billing/IBillingRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";

export function buildBillingSummary(masterId: string, snapshot: BillingSnapshot): BillingSummary {
  const rawExtraTeams = Math.max(0, snapshot.teamCount - 1);
  const rawExtraUsers = Math.max(0, snapshot.totalUsersIncludingMaster - 1);
  const includedExtraTeams = Math.max(0, snapshot.includedExtraTeams);
  const includedExtraUsers = Math.max(0, snapshot.includedExtraUsers);
  const manualAdjustmentExtraTeams = snapshot.manualAdjustmentExtraTeams;
  const manualAdjustmentExtraUsers = snapshot.manualAdjustmentExtraUsers;
  const contractedExtraTeams = Math.max(0, includedExtraTeams + manualAdjustmentExtraTeams);
  const contractedExtraUsers = Math.max(0, includedExtraUsers + manualAdjustmentExtraUsers);
  const availableExtraTeams = Math.max(0, contractedExtraTeams - rawExtraTeams);
  const availableExtraUsers = Math.max(0, contractedExtraUsers - rawExtraUsers);
  const billableTeams = Math.max(rawExtraTeams, contractedExtraTeams);
  const billableUsers = Math.max(rawExtraUsers, contractedExtraUsers);
  const totalTeamSlots = 1 + contractedExtraTeams;
  const totalUserSlots = 1 + contractedExtraUsers;
  const usedTeamSlots = snapshot.teamCount;
  const usedUserSlots = snapshot.totalUsersIncludingMaster;

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
    manualAdjustmentExtraTeams,
    manualAdjustmentExtraUsers,
    contractedExtraTeams,
    contractedExtraUsers,
    totalTeamSlots,
    totalUserSlots,
    usedTeamSlots,
    usedUserSlots,
    availableExtraTeams,
    availableExtraUsers,
    availableTeamSlots: availableExtraTeams,
    availableUserSlots: availableExtraUsers,
    removableTeamSlots: availableExtraTeams,
    removableUserSlots: availableExtraUsers,
    billableTeams,
    billableUsers,
    basePrice,
    extraTeamsPrice,
    extraUsersPrice,
    totalPrice: snapshot.hasPermanentSubscription ? 0 : Number(totalPrice.toFixed(2)),
    hasPermanentSubscription: snapshot.hasPermanentSubscription,
  };
}
