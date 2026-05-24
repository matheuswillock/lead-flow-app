// Subscription Types
export interface SubscriptionData {
  id: string;
  subscriptionAsaasId: string;
  status: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  cycleLabel?: string;
  subscriptionStartedAt?: string;
  lastSyncedAt?: string;
  description: string;
  billingType: string;
  hasPermanentSubscription: boolean; // Assinatura vitalícia (sem custo)
  customer: {
    name: string;
    email: string;
  };
  creditCard?: {
    creditCardNumber: string;
    creditCardBrand: string;
  };
  externalReference?: string;
  createdAt: string;
  billingSummary?: {
    masterId: string;
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
  } | null;
  planDetails?: {
    plan?: string;
    operatorCount?: number;
    teamCount?: number;
    distinctUserCount?: number;
    trialEndDate?: string;
  };
}

export interface SubscriptionInvoice {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string;
  description: string;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
}

// Context Types
export interface ISubscriptionState {
  subscription: SubscriptionData | null;
  invoices: SubscriptionInvoice[];
  isLoading: boolean;
  error: string | null;
}

export interface ISubscriptionActions {
  fetchSubscription: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  syncSubscription: () => Promise<void>;
  updateCredits: (data: UpdateSubscriptionCreditsDTO) => Promise<{ checkoutUrl?: string | null }>;
  cancelSubscription: () => Promise<void>;
  updatePaymentMethod: (cardData: UpdatePaymentMethodDTO) => Promise<void>;
  retryPayment: (invoiceId: string) => Promise<void>;
}

export interface ISubscriptionContext extends ISubscriptionState, ISubscriptionActions {}

export interface ISubscriptionProviderProps {
  children: React.ReactNode;
}

// DTOs
export interface UpdatePaymentMethodDTO {
  creditCardHolderName: string;
  creditCardNumber: string;
  creditCardExpiryMonth: string;
  creditCardExpiryYear: string;
  creditCardCcv: string;
}

export interface UpdateSubscriptionCreditsDTO {
  action: "add" | "remove";
  resource: "team" | "user";
  quantity: number;
  billingType?: "PIX" | "CREDIT_CARD";
}

// Hook Props
export interface UseSubscriptionHookProps {
  supabaseId: string;
  service: ISubscriptionService;
}

export type UseSubscriptionHookReturn = ISubscriptionContext;

// Service Interface
export interface ISubscriptionService {
  getSubscription(supabaseId: string): Promise<SubscriptionData | null>;
  getInvoices(supabaseId: string): Promise<SubscriptionInvoice[]>;
  syncSubscription(supabaseId: string): Promise<boolean>;
  updateCredits(supabaseId: string, data: UpdateSubscriptionCreditsDTO): Promise<{ checkoutUrl?: string | null }>;
  cancelSubscription(supabaseId: string): Promise<boolean>;
  updatePaymentMethod(supabaseId: string, data: UpdatePaymentMethodDTO): Promise<boolean>;
  retryPayment(supabaseId: string, invoiceId: string): Promise<boolean>;
}
