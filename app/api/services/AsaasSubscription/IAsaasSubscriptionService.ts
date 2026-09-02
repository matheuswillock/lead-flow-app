// app/api/services/IAsaasSubscriptionService.ts
import type { AsaasSubscription, AsaasSubscriptionResponse } from './AsaasSubscriptionService';
import type { AsaasAccountId } from '@/lib/asaas';

export interface IAsaasSubscriptionService {
  createManagerSubscription(data: AsaasSubscription, accountId?: AsaasAccountId): Promise<{ success: boolean; subscriptionId: string; data: AsaasSubscriptionResponse }>;
  createOperatorSubscription(data: AsaasSubscription, accountId?: AsaasAccountId): Promise<{ success: boolean; subscriptionId: string; data: AsaasSubscriptionResponse }>;
  createSubscription(data: AsaasSubscription, accountId?: AsaasAccountId): Promise<{ success: boolean; subscriptionId: string; data: AsaasSubscriptionResponse }>;
  getSubscription(subscriptionId: string, accountId?: AsaasAccountId): Promise<AsaasSubscriptionResponse>;
  listSubscriptions(customerId: string, params?: {
    status?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
    offset?: number;
    limit?: number;
  }, accountId?: AsaasAccountId): Promise<{ data: AsaasSubscriptionResponse[]; hasMore: boolean; totalCount: number; limit: number; offset: number }>;
  updateSubscription(subscriptionId: string, data: Partial<AsaasSubscription>, accountId?: AsaasAccountId): Promise<AsaasSubscriptionResponse>;
  cancelSubscription(subscriptionId: string, accountId?: AsaasAccountId): Promise<{ deleted: boolean }>;
  reactivateSubscription(subscriptionId: string, accountId?: AsaasAccountId): Promise<AsaasSubscriptionResponse>;
  getSubscriptionPayments(subscriptionId: string, params?: {
    offset?: number;
    limit?: number;
    status?: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH';
  }, accountId?: AsaasAccountId): Promise<{ data: any[]; hasMore: boolean; totalCount: number; limit: number; offset: number }>;
  updateNextDueDate(subscriptionId: string, nextDueDate: string, accountId?: AsaasAccountId): Promise<AsaasSubscriptionResponse>;
  updateBillingType(subscriptionId: string, billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO', accountId?: AsaasAccountId): Promise<AsaasSubscriptionResponse>;
  /** PIX: obtém dados do QR Code (encodedImage/payload/expirationDate) para um payment específico */
  getPixQrCode(paymentId: string, accountId?: AsaasAccountId): Promise<{ encodedImage: string; payload: string; expirationDate: string }>
  /** BOLETO: obtém linha digitável e código de barras para um payment específico */
  getBoletoIdentificationField(paymentId: string, accountId?: AsaasAccountId): Promise<{ identificationField: string; nossoNumero: string; barCode: string }>
}
