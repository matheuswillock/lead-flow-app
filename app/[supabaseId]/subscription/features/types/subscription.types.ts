// Subscription Types
export interface SubscriptionData {
  id: string;
  subscriptionAsaasId: string;
  status: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  description: string;
  billingType: string;
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
  planDetails?: {
    plan?: string;
    operatorCount?: number;
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
  cancelSubscription(supabaseId: string): Promise<boolean>;
  updatePaymentMethod(supabaseId: string, data: UpdatePaymentMethodDTO): Promise<boolean>;
  retryPayment(supabaseId: string, invoiceId: string): Promise<boolean>;
}
