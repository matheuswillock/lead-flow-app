export const BILLING_PRICES = {
  base: 59.9,
  extraTeam: 29.9,
  extraUser: 19.9,
};

export type BillingSummary = {
  masterId: string;
  hasUnlimitedUsers: boolean;
  teamCount: number;
  distinctUserCount: number;
  totalUsersIncludingMaster: number;
  includedExtraTeams: number;
  includedExtraUsers: number;
  manualAdjustmentExtraTeams: number;
  manualAdjustmentExtraUsers: number;
  contractedExtraTeams: number;
  contractedExtraUsers: number;
  totalTeamSlots: number;
  totalUserSlots: number;
  usedTeamSlots: number;
  usedUserSlots: number;
  availableExtraTeams: number;
  availableExtraUsers: number;
  availableTeamSlots: number;
  availableUserSlots: number;
  removableTeamSlots: number;
  removableUserSlots: number;
  billableTeams: number;
  billableUsers: number;
  basePrice: number;
  extraTeamsPrice: number;
  extraUsersPrice: number;
  totalPrice: number;
  hasPermanentSubscription: boolean;
};
