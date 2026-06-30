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
  timezone: string | null;
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
  invoiceUrl?: string | null;
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

export interface IncrementalChargeCustomerOverride {
  fullName: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  complement?: string;
  city?: string;
  state?: string;
}

export interface IncrementalChargeCreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreateIncrementalChargeInput {
  master: BillingOwnerProfile;
  pendingActionId: string;
  amount: number;
  description: string;
  billingType?: "PIX" | "CREDIT_CARD";
  customerOverride?: IncrementalChargeCustomerOverride;
  creditCard?: IncrementalChargeCreditCard;
  installments?: number;
  remoteIp?: string;
}

export interface SyncRecurringSubscriptionInput {
  master: BillingOwnerProfile;
  targetRecurringTotal: number;
  reason: string;
  nextDueDateOverride?: Date | string | null;
}

export interface EnsureOrSyncRecurringSubscriptionInput extends SyncRecurringSubscriptionInput {
  defaultBillingType?: "PIX" | "CREDIT_CARD";
}

export interface ProportionalChargeData {
  billingDelta: number;
  remainingMonths: number;
  totalCharge: number;
  maxInstallments: number;
}

export interface IIncrementalBillingService {
  projectBilling(masterId: string, input: ProjectBillingInput): Promise<ProjectedBillingSummary>;
  createIncrementalCharge(input: CreateIncrementalChargeInput): Promise<IncrementalChargeResult>;
  syncRecurringSubscription(input: SyncRecurringSubscriptionInput): Promise<void>;
  ensureOrSyncRecurringSubscription(input: EnsureOrSyncRecurringSubscriptionInput): Promise<void>;
  calculateProportionalAmount(masterId: string, addonType: "user" | "team"): Promise<ProportionalChargeData>;
}
