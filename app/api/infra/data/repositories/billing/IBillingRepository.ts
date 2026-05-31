export interface BillingSnapshot {
  hasPermanentSubscription: boolean;
  hasUnlimitedUsers: boolean;
  teamCount: number;
  distinctUserCount: number;
  totalUsersIncludingMaster: number;
  includedExtraTeams: number;
  includedExtraUsers: number;
  manualAdjustmentExtraTeams: number;
  manualAdjustmentExtraUsers: number;
}

export interface IUpdateBillingProfileSubscriptionData {
  asaasSubscriptionId: string;
  subscriptionNextDueDate: Date;
  subscriptionCycle: string;
}

export interface IBillingRepository {
  getBillingSnapshot(masterId: string): Promise<BillingSnapshot | null>;
  updateAsaasCustomerId(profileId: string, asaasCustomerId: string): Promise<void>;
  updateSubscriptionData(profileId: string, data: IUpdateBillingProfileSubscriptionData): Promise<void>;
}
