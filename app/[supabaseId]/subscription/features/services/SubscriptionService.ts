import type {
  SubscriptionData,
  SubscriptionInvoice,
  UpdateSubscriptionCreditsDTO,
  UpdatePaymentMethodDTO
} from '../types/subscription.types';
import { API_CLIENT_BASE } from "@/lib/route-map";
import { ApiRequestError } from "@/lib/http/api-request-error";

export interface ISubscriptionService {
  getSubscription(supabaseId: string): Promise<SubscriptionData | null>;
  getInvoices(supabaseId: string): Promise<SubscriptionInvoice[]>;
  syncSubscription(supabaseId: string): Promise<boolean>;
  updateCredits(supabaseId: string, data: UpdateSubscriptionCreditsDTO): Promise<{ checkoutUrl?: string | null }>;
  cancelSubscription(supabaseId: string, reason?: string): Promise<boolean>;
  updatePaymentMethod(supabaseId: string, data: UpdatePaymentMethodDTO): Promise<boolean>;
  retryPayment(supabaseId: string, invoiceId: string): Promise<boolean>;
}

type ApiOutput = {
  isValid: boolean;
  errorMessages?: string[];
  result?: unknown;
};

export class SubscriptionService implements ISubscriptionService {
  private baseUrl = `${API_CLIENT_BASE}/subscription-management`;

  /**
   * DA1 (SPEC 21): nunca descartar o body do erro. Um `!response.ok` sem ler
   * `errorMessages` degrada 404 de negócio, 403 de permissão e 500 para a
   * mesma mensagem genérica no toast — na janela dual-account isso escondia
   * exatamente o erro que o usuário precisava ver. `ApiRequestError` é o
   * mesmo tipo que `toUserToastMessage`/`toastUserError` já tratam como copy
   * de produto (passa intacto, sem heurística de acentuação).
   */
  private async throwFromResponse(response: Response, fallback: string): Promise<never> {
    const body = (await response.json().catch(() => null)) as ApiOutput | null;
    throw new ApiRequestError(body?.errorMessages?.join(', ') || fallback, response.status);
  }

  async getSubscription(supabaseId: string): Promise<SubscriptionData | null> {
    const response = await fetch(`${this.baseUrl}?supabaseId=${supabaseId}`);

    if (!response.ok) {
      await this.throwFromResponse(response, 'Erro ao carregar assinatura.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao carregar assinatura.', response.status);
    }

    // Backend retorna null quando não há assinatura (comportamento esperado)
    return (result.result as SubscriptionData | null) ?? null;
  }

  async getInvoices(supabaseId: string): Promise<SubscriptionInvoice[]> {
    const response = await fetch(`${this.baseUrl}/invoices?supabaseId=${supabaseId}`);

    if (!response.ok) {
      await this.throwFromResponse(response, 'Erro ao carregar faturas.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao carregar faturas.', response.status);
    }

    return (result.result as SubscriptionInvoice[]) || [];
  }

  async syncSubscription(supabaseId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/sync?supabaseId=${supabaseId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      await this.throwFromResponse(response, 'Erro ao sincronizar assinatura.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao sincronizar assinatura.', response.status);
    }

    return true;
  }

  async updateCredits(
    supabaseId: string,
    data: UpdateSubscriptionCreditsDTO
  ): Promise<{ checkoutUrl?: string | null }> {
    const response = await fetch(`${this.baseUrl}/credits?supabaseId=${supabaseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.throwFromResponse(response, 'Erro ao atualizar créditos.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao atualizar créditos.', response.status);
    }

    return {
      checkoutUrl: (result.result as { checkoutUrl?: string | null } | undefined)?.checkoutUrl ?? null,
    };
  }

  async cancelSubscription(supabaseId: string, reason?: string): Promise<boolean> {
    const url = `${this.baseUrl}?supabaseId=${supabaseId}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      await this.throwFromResponse(response, 'Erro ao cancelar assinatura.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao cancelar assinatura.', response.status);
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
      await this.throwFromResponse(response, 'Erro ao atualizar método de pagamento.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao atualizar método de pagamento.', response.status);
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
      await this.throwFromResponse(response, 'Erro ao retentar pagamento.');
    }

    const result = (await response.json()) as ApiOutput;

    if (!result.isValid) {
      throw new ApiRequestError(result.errorMessages?.join(', ') || 'Erro ao retentar pagamento.', response.status);
    }

    return true;
  }
}

export const subscriptionService = new SubscriptionService();
