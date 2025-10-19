// app/subscribe/features/services/ISubscriptionService.ts
import type { SubscriptionFormData } from '../types/SubscriptionTypes';

export interface SubscriptionResponse {
  success: boolean;
  customerId?: string;
  subscriptionId?: string;
  paymentUrl?: string;
  paymentId?: string;
  pix?: { encodedImage: string; payload: string; expirationDate: string };
  boleto?: { bankSlipUrl: string; identificationField: string; barCode: string; dueDate: string };
  message: string;
  existingSubscription?: boolean;
  paymentStatus?: string;
  alreadyActive?: boolean;
}

export interface ISubscriptionService {
  createSubscription(data: SubscriptionFormData): Promise<SubscriptionResponse>;
}
