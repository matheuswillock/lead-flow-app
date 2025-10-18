// app/api/services/PaymentValidation/PaymentValidationService.ts

import { IPaymentValidationService, PaymentValidationResult } from './IPaymentValidationService';
import { IPaymentRepository } from '../../infra/data/repositories/payment/IPaymentRepository';
import type { AsaasPayment, AsaasSubscription } from './AsaasWebhookTypes';
import { isAsaasPayment, isAsaasSubscription } from './AsaasWebhookTypes';

export class PaymentValidationService implements IPaymentValidationService {
  constructor(private paymentRepository: IPaymentRepository) {}

  async validatePayment(paymentId: string): Promise<PaymentValidationResult> {
    try {
      console.info(
        `[PaymentValidationService] Validando pagamento: ${paymentId}`
      );

      // Buscar informações do pagamento no Asaas
      const response = await fetch(
        `${process.env.ASAAS_API_URL}/payments/${paymentId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            access_token: process.env.ASAAS_API_KEY || '',
          },
        }
      );

      if (!response.ok) {
        console.error(
          `[PaymentValidationService] Erro ao buscar pagamento: ${response.status}`
        );
        return {
          success: false,
          isPaid: false,
          message: 'Erro ao buscar informações do pagamento',
        };
      }

      const payment = await response.json();
      console.info(
        `[PaymentValidationService] Status do pagamento: ${payment.status}`
      );

      // Status possíveis: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc
      const isPaid = ['RECEIVED', 'CONFIRMED'].includes(payment.status);

      if (isPaid) {
        // Atualizar profile se pagamento confirmado
        const profileUpdated = await this.updateProfileStatus(
          payment.customer,
          payment.subscription
        );

        return {
          success: true,
          isPaid: true,
          paymentStatus: payment.status,
          profileUpdated,
          message: 'Pagamento confirmado!',
        };
      }

      return {
        success: true,
        isPaid: false,
        paymentStatus: payment.status,
        message: 'Pagamento ainda não foi confirmado',
      };
    } catch (error: any) {
      console.error('[PaymentValidationService] Erro:', error);
      return {
        success: false,
        isPaid: false,
        message: error.message || 'Erro ao validar pagamento',
      };
    }
  }

  async processWebhook(
    event: string,
    paymentData: unknown
  ): Promise<PaymentValidationResult> {
    try {
      console.info(`🔔 [PaymentValidationService] Processando webhook: ${event}`);

      // SUBSCRIPTION_CREATED (sem payment): payload é subscription
      if (event === 'SUBSCRIPTION_CREATED' && paymentData && isAsaasSubscription(paymentData as any)) {
        const sub = paymentData as AsaasSubscription;
        console.info('[PaymentValidationService] SUBSCRIPTION_CREATED recebido', {
          subscriptionId: sub.id,
          customerId: sub.customer,
          externalRef: sub.externalReference,
        });

        if (!sub.externalReference || !sub.id || !sub.customer) {
          return { success: true, isPaid: false, message: 'SUBSCRIPTION_CREATED sem dados suficientes para vincular' };
        }

        const profile = await this.paymentRepository.findByEmail(sub.externalReference);
        if (!profile) {
          console.warn('[PaymentValidationService] Profile não encontrado por email no SUBSCRIPTION_CREATED');
          return { success: true, isPaid: false, message: 'Profile não encontrado para SUBSCRIPTION_CREATED' };
        }

        await this.paymentRepository.updateSubscriptionData(profile.id, {
          asaasCustomerId: sub.customer,
          subscriptionId: sub.id,
          subscriptionPlan: 'manager_base',
          subscriptionStatus: 'active',
          subscriptionStartDate: new Date(),
        });

        console.info(`[PaymentValidationService] ✅ Profile vinculado no SUBSCRIPTION_CREATED: ${profile.id}`);
        return { success: true, isPaid: false, paymentStatus: 'PENDING', profileUpdated: true, message: 'Assinatura vinculada ao Profile' };
      }

      // Pagamentos: payload é payment
      if (!paymentData || !isAsaasPayment(paymentData as any)) {
        console.warn('[PaymentValidationService] Payload de webhook não reconhecido');
        return { success: true, isPaid: false, message: 'Payload não reconhecido' };
      }

      const payment = paymentData as AsaasPayment;
      console.info(`💳 [PaymentValidationService] Status do pagamento: ${payment.status}`);

      // (bloco SUBSCRIPTION_CREATED já tratado acima com tipagem forte)

      // Eventos que indicam pagamento confirmado
      const confirmedEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];

      // Validação rigorosa: evento E status devem estar corretos
      const isConfirmedEvent = confirmedEvents.includes(event);
  const isConfirmedStatus = ['RECEIVED', 'CONFIRMED'].includes(payment.status);

      if (!isConfirmedEvent) {
        console.warn(
          `⚠️ [PaymentValidationService] Evento NÃO é de confirmação: ${event} (esperado: PAYMENT_RECEIVED ou PAYMENT_CONFIRMED)`
        );
        return {
          success: true,
          isPaid: false,
          paymentStatus: payment.status,
          message: `Evento ${event} processado mas não é confirmação de pagamento`,
        };
      }

      if (!isConfirmedStatus) {
        console.warn(
          `⚠️ [PaymentValidationService] Status do pagamento NÃO confirmado: ${payment.status} (esperado: RECEIVED ou CONFIRMED)`
        );
        return {
          success: true,
          isPaid: false,
          paymentStatus: payment.status,
          message: `Status ${payment.status} não indica pagamento confirmado`,
        };
      }

      console.info('✅ [PaymentValidationService] Pagamento CONFIRMADO! Atualizando profile...');

      // Atualizar profile com dados completos de assinatura
      const profileUpdated = await this.updateProfileStatus(payment.customer, payment.subscription);

      return {
        success: true,
        isPaid: true,
        paymentStatus: payment.status,
        profileUpdated,
        message: 'Pagamento confirmado via webhook',
      };
    } catch (error: any) {
      console.error('[PaymentValidationService] Erro no webhook:', error);
      return {
        success: false,
        isPaid: false,
        message: error.message || 'Erro ao processar webhook',
      };
    }
  }

  private async updateProfileStatus(
    asaasCustomerId: string,
    subscriptionId?: string
  ): Promise<boolean> {
    try {
      let profile;

      // Buscar por subscriptionId primeiro
      if (subscriptionId) {
        profile = await this.paymentRepository.findBySubscriptionId(
          subscriptionId
        );
        console.info(
          `[PaymentValidationService] Profile por subscriptionId: ${profile?.id || 'não encontrado'}`
        );
      }

      // Se não encontrar, buscar por asaasCustomerId
      if (!profile) {
        profile = await this.paymentRepository.findByAsaasCustomerId(
          asaasCustomerId
        );
        console.info(
          `[PaymentValidationService] Profile por asaasCustomerId: ${profile?.id || 'não encontrado'}`
        );
      }

      if (!profile) {
        console.warn(
          `[PaymentValidationService] ⚠️ Profile não encontrado. Isso é esperado - será criado no sign-up.`
        );
        console.info(
          `[PaymentValidationService] 📝 Dados disponíveis: customer=${asaasCustomerId}, subscription=${subscriptionId}`
        );
        // NÃO é erro - o profile será criado quando o usuário completar o sign-up
        return true; // Retornar true para não causar erro no webhook
      }

      // Atualizar dados completos
      await this.paymentRepository.updateSubscriptionData(profile.id, {
        asaasCustomerId,
        subscriptionId,
        subscriptionPlan: 'manager_base',
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
      });

      console.info(
        `[PaymentValidationService] ✅ Profile atualizado: ${profile.id}`
      );
      return true;
    } catch (error: any) {
      console.error(
        '[PaymentValidationService] Erro ao atualizar profile:',
        error
      );
      return false;
    }
  }
}
