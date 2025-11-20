import type { 
  SubscriptionData, 
  SubscriptionInvoice, 
  UpdatePaymentMethodDTO 
} from '../types/subscription.types';

export interface ISubscriptionService {
  getSubscription(supabaseId: string): Promise<SubscriptionData | null>;
  getInvoices(supabaseId: string): Promise<SubscriptionInvoice[]>;
  cancelSubscription(supabaseId: string, reason?: string): Promise<boolean>;
  updatePaymentMethod(supabaseId: string, data: UpdatePaymentMethodDTO): Promise<boolean>;
  retryPayment(supabaseId: string, invoiceId: string): Promise<boolean>;
}

export class SubscriptionService implements ISubscriptionService {
  private baseUrl = '/api/v1/subscription-management';

  async getSubscription(supabaseId: string): Promise<SubscriptionData | null> {
    const response = await fetch(`${this.baseUrl}?supabaseId=${supabaseId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }

    // Backend retorna null quando não há assinatura (comportamento esperado)
    return result.result;
  }

  async getInvoices(supabaseId: string): Promise<SubscriptionInvoice[]> {
    const response = await fetch(`${this.baseUrl}/invoices?supabaseId=${supabaseId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }

    return result.result || [];
  }

  async cancelSubscription(supabaseId: string, reason?: string): Promise<boolean> {
    const url = `${this.baseUrl}?supabaseId=${supabaseId}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }

    return true;
  }

  async updatePaymentMethod(
    supabaseId: string,
    data: UpdatePaymentMethodDTO
  ): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/payment-method`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseId, ...data })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }

    return true;
  }

  async retryPayment(supabaseId: string, invoiceId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/invoices/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseId, invoiceId })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }

    return true;
  }
}

export const subscriptionService = new SubscriptionService();
