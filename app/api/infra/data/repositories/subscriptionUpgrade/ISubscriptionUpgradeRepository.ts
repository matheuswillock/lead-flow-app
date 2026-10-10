import type { Profile, UserRole, UserFunction, PendingOperator } from "@prisma/client";
import type { AsaasAccountId } from "@/lib/asaas";

export interface SubscriptionUpgradeManagerProfile {
  id: string;
  supabaseId: string | null;
  email: string;
  fullName: string | null;
  role: UserRole;
  isMaster: boolean;
  asaasCustomerId: string | null;
  asaasCustomerAccount: AsaasAccountId | null;
  asaasSubscriptionId: string | null;
  asaasSubscriptionAccount: AsaasAccountId | null;
  subscriptionStatus: string | null;
  subscriptionNextDueDate: Date | null;
  subscriptionCycle: string | null;
  operatorCount: number;
  timezone: string | null;
  cpfCnpj: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
}

export interface SubscriptionUpgradeOperatorProfile {
  id: string;
  supabaseId: string | null;
  fullName: string | null;
  email: string;
  role: UserRole;
  functions: UserFunction[];
  managerId: string | null;
  asaasSubscriptionId: string | null;
}

export interface SubscriptionUpgradePendingOperator extends PendingOperator {
  manager: SubscriptionUpgradeManagerProfile;
}

export interface SubscriptionUpgradeTeam {
  id: string;
  masterId: string;
  isDefault: boolean;
  deletedAt: Date | null;
  master: {
    sponsorMasterId: string | null;
  };
}

export interface SubscriptionUpgradeProfileSubscription {
  hasPermanentSubscription: boolean;
  asaasSubscriptionId: string | null;
  asaasSubscriptionAccount: AsaasAccountId | null;
  product: {
    id: string;
    name: string;
    priceMonthly: number | null;
    isActive: boolean;
  } | null;
  capacity: {
    includedExtraUsers: number;
    includedExtraTeams: number;
    manualAdjustmentExtraUsers: number;
    manualAdjustmentExtraTeams: number;
  } | null;
}

export interface CreateOperatorProfileInput {
  supabaseId: string;
  fullName: string;
  email: string;
  role: UserRole;
  functions: UserFunction[];
  managerId: string;
  asaasSubscriptionId?: string;
  subscriptionCycle?: string;
}

export interface ISubscriptionUpgradeRepository {
  // Profile operations
  findManagerProfileById(managerId: string): Promise<SubscriptionUpgradeManagerProfile | null>;
  findManagerProfileBySupabaseId(supabaseId: string): Promise<SubscriptionUpgradeManagerProfile | null>;
  findProfileById(id: string): Promise<Pick<Profile, "id" | "managerId"> | null>;
  updateManagerCustomerId(managerId: string, asaasCustomerId: string, asaasCustomerAccount: AsaasAccountId): Promise<void>;
  decrementManagerOperatorCount(managerId: string): Promise<void>;
  provisionConfirmedOperator(input: {
    pendingOperatorId: string;
    managerId: string;
    teamId: string;
    operator: CreateOperatorProfileInput;
  }): Promise<SubscriptionUpgradeOperatorProfile>;
  findProfileByEmail(email: string): Promise<SubscriptionUpgradeProfileContact | null>;

  // Team operations
  findDefaultTeamByMasterId(masterId: string): Promise<SubscriptionUpgradeTeam | null>;
  countActiveTeamsByMasterId(masterId: string): Promise<number>;


  // PendingOperator operations
  createPendingOperator(input: {
    managerId: string;
    teamId: string | null;
    name: string;
    email: string;
    role: string;
    functions: UserFunction[];
    paymentId: string;
    subscriptionId: string | null;
    paymentStatus: string;
    paymentMethod: string;
    asaasAccount: AsaasAccountId;
  }): Promise<PendingOperator>;
  findActivePendingOperatorByManagerAndEmail(managerId: string, email: string): Promise<{ id: string; createdAt: Date } | null>;
  findPendingOperatorByPaymentIdWithManager(paymentId: string, account?: AsaasAccountId): Promise<SubscriptionUpgradePendingOperator | null>;
  findPendingOperatorByIdWithManager(id: string): Promise<SubscriptionUpgradePendingOperator | null>;
  findPendingOperatorBySubscriptionId(subscriptionId: string): Promise<SubscriptionUpgradePendingOperator | null>;
  updatePendingOperatorPaymentId(id: string, paymentId: string, account: AsaasAccountId): Promise<void>;
  updatePendingOperatorPaymentStatus(id: string, paymentStatus: string): Promise<void>;
  markPendingOperatorSubscriptionUpdated(id: string): Promise<void>;
  deletePendingOperatorById(id: string): Promise<void>;

  // ProfileSubscription operations
  findProfileSubscriptionByProfileId(profileId: string): Promise<SubscriptionUpgradeProfileSubscription | null>;
  findProfileSubscriptionById(profileId: string): Promise<SubscriptionUpgradeProfileSubscription | null>;
}

export type SubscriptionUpgradeProfileContact = Pick<Profile, "id" | "email" | "fullName">;
