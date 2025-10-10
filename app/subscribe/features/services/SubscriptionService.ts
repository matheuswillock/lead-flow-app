// app/subscribe/features/services/SubscriptionService.ts
import type { ISubscriptionService, SubscriptionResponse } from './ISubscriptionService';
import type { SubscriptionFormData } from '../types/SubscriptionTypes';

export class SubscriptionService implements ISubscriptionService {
  async createSubscription(data: SubscriptionFormData): Promise<SubscriptionResponse> {
    try {
      const response = await fetch('/api/v1/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const output = await response.json();

      console.info('📥 [SubscriptionService] Response recebido:', {
        isValid: output?.isValid,
        hasResult: !!output?.result,
        resultKeys: output?.result ? Object.keys(output.result) : [],
        hasPix: !!output?.result?.pix,
        hasBoleto: !!output?.result?.boleto,
        hasPaymentId: !!output?.result?.paymentId
      });

      if (!response.ok || !output?.isValid) {
        throw new Error(output?.errorMessages?.[0] || output?.message || 'Erro ao criar assinatura');
      }

      const res = output.result || output.data || {};
      return {
        success: true,
        customerId: res.customerId,
        subscriptionId: res.subscriptionId,
        paymentUrl: res.paymentUrl,
        paymentId: res.paymentId,
        pix: res.pix,
        boleto: res.boleto,
        message: (output.successMessages && output.successMessages[0]) || output.message || 'Assinatura criada com sucesso!',
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar assinatura:', error);
      return {
        success: false,
        message: error.message || 'Erro ao processar assinatura',
      };
    }
  }
}
