import type { BillingSummary } from "@/app/api/shared/billing/billingConfig";

export type IncrementalBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export interface BillingOwnerProfile {
  id: string;
  fullName: string | null;
  email: string;
  cpfCnpj: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  complement: string | null;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionNextDueDate: Date | null;
  subscriptionCycle: string | null;
  hasPermanentSubscription: boolean;
}

export interface ProjectBillingInput {
  additionalTeams?: number;
  additionalUsers?: number;
}

export interface ProjectedBillingSummary {
  currentSummary: BillingSummary;
  nextTeamCount: number;
  nextTotalUsersIncludingMaster: number;
  nextBillableTeams: number;
  nextBillableUsers: number;
  targetRecurringTotal: number;
  billingDelta: number;
}

export interface IncrementalChargeResult {
  paymentId: string;
  paymentStatus: string;
  billingType: IncrementalBillingType;
  amount: number;
  dueDate: string;
  externalReference: string;
  pix?: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  };
  boleto?: {
    bankSlipUrl: string | null;
    identificationField: string;
    barCode: string;
    dueDate: string | null;
  };
}

export interface CreateIncrementalChargeInput {
  master: BillingOwnerProfile;
  pendingActionId: string;
  amount: number;
  description: string;
}

export interface SyncRecurringSubscriptionInput {
  master: BillingOwnerProfile;
  targetRecurringTotal: number;
  reason: string;
}

export interface IIncrementalBillingService {
  projectBilling(masterId: string, input: ProjectBillingInput): Promise<ProjectedBillingSummary>;
  createIncrementalCharge(input: CreateIncrementalChargeInput): Promise<IncrementalChargeResult>;
  syncRecurringSubscription(input: SyncRecurringSubscriptionInput): Promise<void>;
}
