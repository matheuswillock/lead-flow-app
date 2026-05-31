import type { BillingSnapshot } from "@/app/api/infra/data/repositories/billing/IBillingRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";

export function buildBillingSummary(masterId: string, snapshot: BillingSnapshot): BillingSummary {
  const hasUnlimitedUsers = snapshot.hasUnlimitedUsers;
  const rawExtraTeams = Math.max(0, snapshot.teamCount - 1);
  const rawExtraUsers = Math.max(0, snapshot.totalUsersIncludingMaster - 1);
  const includedExtraTeams = Math.max(0, snapshot.includedExtraTeams);
  const includedExtraUsers = Math.max(0, snapshot.includedExtraUsers);
  const manualAdjustmentExtraTeams = snapshot.manualAdjustmentExtraTeams;
  const manualAdjustmentExtraUsers = snapshot.manualAdjustmentExtraUsers;
  const contractedExtraTeams = Math.max(0, includedExtraTeams + manualAdjustmentExtraTeams);
  const contractedExtraUsers = Math.max(0, includedExtraUsers + manualAdjustmentExtraUsers);
  const availableExtraTeams = Math.max(0, contractedExtraTeams - rawExtraTeams);
  const availableExtraUsers = hasUnlimitedUsers ? 0 : Math.max(0, contractedExtraUsers - rawExtraUsers);
  const billableTeams = Math.max(rawExtraTeams, contractedExtraTeams);
  const billableUsers = hasUnlimitedUsers ? 0 : Math.max(rawExtraUsers, contractedExtraUsers);
  const totalTeamSlots = 1 + contractedExtraTeams;
  const totalUserSlots = hasUnlimitedUsers ? snapshot.totalUsersIncludingMaster : 1 + contractedExtraUsers;
  const usedTeamSlots = snapshot.teamCount;
  const usedUserSlots = snapshot.totalUsersIncludingMaster;

  const basePrice = BILLING_PRICES.base;
  const extraTeamsPrice = billableTeams * BILLING_PRICES.extraTeam;
  const extraUsersPrice = hasUnlimitedUsers ? 0 : billableUsers * BILLING_PRICES.extraUser;
  const totalPrice = basePrice + extraTeamsPrice + extraUsersPrice;

  return {
    masterId,
    hasUnlimitedUsers,
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
    availableUserSlots: hasUnlimitedUsers ? Number.MAX_SAFE_INTEGER : availableExtraUsers,
    removableTeamSlots: availableExtraTeams,
    removableUserSlots: hasUnlimitedUsers ? 0 : availableExtraUsers,
    billableTeams,
    billableUsers,
    basePrice,
    extraTeamsPrice,
    extraUsersPrice,
    totalPrice: snapshot.hasPermanentSubscription ? 0 : Number(totalPrice.toFixed(2)),
    hasPermanentSubscription: snapshot.hasPermanentSubscription,
  };
}
