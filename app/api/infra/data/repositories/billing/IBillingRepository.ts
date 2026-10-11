import type { AsaasAccountId } from "@/lib/asaas";

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
  // Achado P1 da revisão do PR #1207 (chatgpt-codex-connector, thread
  // PRRT_...CUk4): obrigatório — sem ele o upsert de ProfileSubscription
  // cai no `@default(primary)` do schema mesmo gravando um sub_ legacy.
  asaasSubscriptionAccount: AsaasAccountId;
  subscriptionNextDueDate: Date;
  subscriptionCycle: string;
}

export interface IBillingRepository {
  getBillingSnapshot(masterId: string): Promise<BillingSnapshot | null>;
  updateAsaasCustomerId(profileId: string, asaasCustomerId: string): Promise<void>;
  updateSubscriptionData(profileId: string, data: IUpdateBillingProfileSubscriptionData): Promise<void>;
}
