export const BILLING_PRICES = {
  base: 59.9,
  extraTeam: 29.9,
  extraUser: 19.9,
};

export type BillingSummary = {
  masterId: string;
  teamCount: number;
  distinctUserCount: number;
  totalUsersIncludingMaster: number;
  billableTeams: number;
  billableUsers: number;
  basePrice: number;
  extraTeamsPrice: number;
  extraUsersPrice: number;
  totalPrice: number;
  hasPermanentSubscription: boolean;
};
