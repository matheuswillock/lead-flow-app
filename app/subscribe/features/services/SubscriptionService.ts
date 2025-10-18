// app/subscribe/features/services/SubscriptionService.ts
import type { ISubscriptionService, SubscriptionResponse } from './ISubscriptionService';
import type { SubscriptionFormData } from '../types/SubscriptionTypes';
import { unmask } from '@/lib/masks';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export class SubscriptionService implements ISubscriptionService {
  async createSubscription(data: SubscriptionFormData): Promise<SubscriptionResponse> {
    try {
      // Remover máscaras antes de enviar para a API
      const cleanData = {
        ...data,
        cpfCnpj: unmask(data.cpfCnpj),
        phone: unmask(data.phone),
        postalCode: unmask(data.postalCode || ''),
      };

      console.info('📤 [SubscriptionService] Enviando dados:', {
        fullName: cleanData.fullName,
        email: cleanData.email,
        cpfCnpj: cleanData.cpfCnpj ? `${cleanData.cpfCnpj.substring(0, 3)}***` : '',
        cpfCnpjLength: cleanData.cpfCnpj?.length || 0,
        phone: cleanData.phone ? `${cleanData.phone.substring(0, 4)}***` : '',
        phoneLength: cleanData.phone?.length || 0,
        billingType: cleanData.billingType
      });

      // Tentar identificar o usuário autenticado para enviar no header
      let supabaseUserId: string | undefined = undefined;
      try {
        const supabase = createSupabaseBrowser();
        const { data: { user } } = await (supabase?.auth.getUser() || { data: { user: null } });
        supabaseUserId = user?.id;
      } catch (_) {
        // ignore
      }

      const response = await fetch('/api/v1/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseUserId ? { 'x-supabase-user-id': supabaseUserId } : {}),
        },
        body: JSON.stringify(cleanData),
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
