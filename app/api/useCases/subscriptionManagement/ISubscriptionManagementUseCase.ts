import type { Output } from "@/lib/output";

// Types
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

export interface UpdatePaymentMethodDTO {
  creditCardHolderName: string;
  creditCardNumber: string;
  creditCardExpiryMonth: string;
  creditCardExpiryYear: string;
  creditCardCcv: string;
}

export interface ISubscriptionManagementUseCase {
  getSubscription(supabaseId: string): Promise<Output>;
  getInvoices(supabaseId: string): Promise<Output>;
  cancelSubscription(supabaseId: string, reason?: string): Promise<Output>;
  updatePaymentMethod(
    supabaseId: string, 
    paymentData: UpdatePaymentMethodDTO
  ): Promise<Output>;
  retryPayment(supabaseId: string, invoiceId: string): Promise<Output>;
}
