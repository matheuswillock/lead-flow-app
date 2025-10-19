// Strongly-typed models for Asaas webhook payloads used by our handlers

export type PaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'APPROVED'
  | 'REFUSED'
  | 'BANK_PROCESSING'
  | string; // fallback for any newer status we don't yet map

export type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | string;

export interface AsaasPayment {
  object: 'payment';
  id: string;
  customer: string; // asaas customer id
  subscription?: string; // asaas subscription id
  status: PaymentStatus;
  billingType: BillingType;
  value: number;
  description?: string;
  dueDate?: string; // ISO yyyy-mm-dd
  paymentDate?: string; // ISO yyyy-mm-dd
  confirmedDate?: string; // ISO yyyy-mm-dd
  invoiceUrl?: string;
  invoiceNumber?: string;
  externalReference?: string; // we set email in current flow
}

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED'
  | string;

export type SubscriptionCycle = 'MONTHLY' | 'WEEKLY' | 'YEARLY' | string;

export interface AsaasSubscription {
  object: 'subscription';
  id: string;
  customer: string; // asaas customer id
  status: SubscriptionStatus;
  value: number;
  cycle?: SubscriptionCycle;
  description?: string;
  externalReference?: string; // we set email in current flow (or profile id in the future)
}

export function isAsaasPayment(
  payload: AsaasPayment | AsaasSubscription
): payload is AsaasPayment {
  return 'object' in payload && payload.object === 'payment';
}

export function isAsaasSubscription(
  payload: AsaasPayment | AsaasSubscription
): payload is AsaasSubscription {
  return 'object' in payload && payload.object === 'subscription';
}
