// app/api/services/IAsaasSubscriptionService.ts
import type { AsaasSubscription, AsaasSubscriptionResponse } from './AsaasSubscriptionService';

export interface IAsaasSubscriptionService {
  createManagerSubscription(data: AsaasSubscription): Promise<{ success: boolean; subscriptionId: string; data: AsaasSubscriptionResponse }>;
  createOperatorSubscription(data: AsaasSubscription): Promise<{ success: boolean; subscriptionId: string; data: AsaasSubscriptionResponse }>;
  createSubscription(data: AsaasSubscription): Promise<{ success: boolean; subscriptionId: string; data: AsaasSubscriptionResponse }>;
  getSubscription(subscriptionId: string): Promise<AsaasSubscriptionResponse>;
  listSubscriptions(customerId: string, params?: {
    status?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
    offset?: number;
    limit?: number;
  }): Promise<{ data: AsaasSubscriptionResponse[]; hasMore: boolean; totalCount: number; limit: number; offset: number }>;
  updateSubscription(subscriptionId: string, data: Partial<AsaasSubscription>): Promise<AsaasSubscriptionResponse>;
  cancelSubscription(subscriptionId: string): Promise<{ deleted: boolean }>;
  reactivateSubscription(subscriptionId: string): Promise<AsaasSubscriptionResponse>;
  getSubscriptionPayments(subscriptionId: string, params?: {
    offset?: number;
    limit?: number;
    status?: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH';
  }): Promise<{ data: any[]; hasMore: boolean; totalCount: number; limit: number; offset: number }>;
  updateNextDueDate(subscriptionId: string, nextDueDate: string): Promise<AsaasSubscriptionResponse>;
  updateBillingType(subscriptionId: string, billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO'): Promise<AsaasSubscriptionResponse>;
}
