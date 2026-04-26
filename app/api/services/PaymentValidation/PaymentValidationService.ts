// app/api/services/PaymentValidation/PaymentValidationService.ts

import { IPaymentValidationService, PaymentValidationResult } from './IPaymentValidationService';
import { IPaymentRepository } from '../../infra/data/repositories/payment/IPaymentRepository';
import type { AsaasPayment, AsaasSubscription } from './AsaasWebhookTypes';
import { isAsaasPayment, isAsaasSubscription } from './AsaasWebhookTypes';
import { createEmailService } from '@/lib/services/EmailService';
import { asaasApi, asaasFetch } from '@/lib/asaas';
import { getAppUrl } from '@/lib/utils/app-url';

export class PaymentValidationService implements IPaymentValidationService {
  constructor(private paymentRepository: IPaymentRepository) {}

  async validatePayment(paymentId: string): Promise<PaymentValidationResult> {
    try {
      console.info(
        `[PaymentValidationService] Validando pagamento: ${paymentId}`
      );

      // Buscar informações do pagamento no Asaas usando a lib
      const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
        method: 'GET',
      });
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

      // SUBSCRIPTION_* (sem payment): payload é subscription
      const subscriptionEvents = ['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_SUSPENDED', 'SUBSCRIPTION_CANCELED'];
      if (subscriptionEvents.includes(event) && paymentData && isAsaasSubscription(paymentData as any)) {
        const sub = paymentData as AsaasSubscription;
        console.info('[PaymentValidationService] SUBSCRIPTION_CREATED recebido', {
          subscriptionId: sub.id,
          customerId: sub.customer,
          externalRef: sub.externalReference,
        });

        if (!sub.externalReference || !sub.id || !sub.customer) {
          return { success: true, isPaid: false, message: 'SUBSCRIPTION_CREATED sem dados suficientes para vincular' };
        }

        // externalReference agora pode ser o UUID do Profile; se não achar por id, tentar por email (compatibilidade)
        let profile = await this.paymentRepository.findById(sub.externalReference);
        if (!profile) {
          profile = await this.paymentRepository.findByEmail(sub.externalReference);
        }
        if (!profile) {
          console.warn('[PaymentValidationService] Profile não encontrado por email no SUBSCRIPTION_CREATED');
          return { success: true, isPaid: false, message: 'Profile não encontrado para SUBSCRIPTION_CREATED' };
        }

        // Mapear status considerando primeiro o próprio evento e depois o status vindo do Asaas
        const mapStatusFromEvent = (evt: string): 'active' | 'suspended' | 'canceled' | undefined => {
          switch (evt) {
            case 'SUBSCRIPTION_ACTIVATED':
            case 'SUBSCRIPTION_CREATED':
              return 'active';
            case 'SUBSCRIPTION_SUSPENDED':
            case 'SUBSCRIPTION_INACTIVATED':
              return 'suspended';
            case 'SUBSCRIPTION_CANCELED':
            case 'SUBSCRIPTION_DELETED':
              return 'canceled';
            default:
              return undefined;
          }
        };

        const mapStatusFromPayload = (status: string | undefined): 'active' | 'suspended' | 'canceled' | undefined => {
          if (!status) return undefined;
          const s = status.toUpperCase();
          if (s === 'ACTIVE') return 'active';
          if (s === 'SUSPENDED' || s === 'INACTIVATED') return 'suspended';
          if (s === 'CANCELLED' || s === 'CANCELED') return 'canceled';
          return undefined;
        };

        const mappedFromEvent = mapStatusFromEvent(event);
        const mappedFromPayload = mapStatusFromPayload(sub.status);
        const mappedStatus = mappedFromEvent ?? mappedFromPayload ?? 'active';

        const endDate = mappedStatus === 'canceled' ? new Date() : undefined;
        const startDate = mappedStatus === 'active' ? new Date() : undefined;

        await this.paymentRepository.updateSubscriptionData(profile.id, {
          asaasCustomerId: sub.customer,
          subscriptionId: sub.id,
          subscriptionPlan: 'manager_base',
          subscriptionStatus: mappedStatus,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
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

  // Tratar pagamentos em atraso (OVERDUE) -> marcar como past_due
  if (event === 'PAYMENT_OVERDUE' || payment.status === 'OVERDUE') {
        try {
          let profile: Awaited<ReturnType<IPaymentRepository['findBySubscriptionId']>> = null;
          if (payment.subscription) {
            profile = await this.paymentRepository.findBySubscriptionId(payment.subscription);
          }
          if (!profile) {
            profile = await this.paymentRepository.findByAsaasCustomerId(payment.customer);
          }
          if (profile) {
            await this.paymentRepository.updateSubscriptionData(profile.id, {
              subscriptionStatus: 'past_due',
            });
            console.info(`[PaymentValidationService] 🔶 Profile marcado como past_due por OVERDUE: ${profile.id}`);
            return {
              success: true,
              isPaid: false,
              paymentStatus: payment.status,
              profileUpdated: true,
              message: 'Pagamento em atraso. Status marcado como past_due.',
            };
          }
        } catch (e) {
          console.error('[PaymentValidationService] Erro ao marcar past_due:', e);
        }
        // Mesmo sem profile, retornar sucesso para não bloquear o webhook
        return {
          success: true,
          isPaid: false,
          paymentStatus: payment.status,
          message: 'Pagamento em atraso processado',
        };
      }

  // Eventos que indicam pagamento confirmado
  const confirmedEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];

      // Validação rigorosa: evento E status devem estar corretos
    const isConfirmedEvent = confirmedEvents.includes(event);
  const isConfirmedStatus = ['RECEIVED', 'CONFIRMED'].includes(payment.status);
  const isCardApproved = payment.billingType === 'CREDIT_CARD' && (payment.status === 'APPROVED' || event === 'PAYMENT_APPROVED');

      if (!isConfirmedEvent && !isCardApproved) {
        console.warn(
          `⚠️ [PaymentValidationService] Evento NÃO é de confirmação: ${event} (esperado: PAYMENT_RECEIVED, PAYMENT_CONFIRMED ou cartão APPROVED)`
        );
        return {
          success: true,
          isPaid: false,
          paymentStatus: payment.status,
          message: `Evento ${event} processado mas não é confirmação de pagamento`,
        };
      }

      if (!isConfirmedStatus && !isCardApproved) {
        console.warn(
          `⚠️ [PaymentValidationService] Status do pagamento NÃO confirmado: ${payment.status} (esperado: RECEIVED, CONFIRMED ou cartão APPROVED)`
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

      // Disparar e-mail de confirmação de assinatura (PIX confirmado ou cartão aprovado)
      try {
        // Encontrar o profile para obter email/nome
        let profile = null as Awaited<ReturnType<IPaymentRepository['findBySubscriptionId']>>;
        if (payment.subscription) {
          profile = await this.paymentRepository.findBySubscriptionId(payment.subscription);
        }
        if (!profile) {
          profile = await this.paymentRepository.findByAsaasCustomerId(payment.customer);
        }

        // Fallback: se não encontrar profile, tentar usar externalReference como email
        const userEmail = profile?.email || (payment.externalReference && payment.externalReference.includes('@') ? payment.externalReference : undefined);

        if (userEmail) {
          const userName = profile?.fullName || userEmail.split('@')[0];
          const appUrl = getAppUrl({ removeTrailingSlash: true });
          const manageUrl = profile?.supabaseId ? `${appUrl}/${profile.supabaseId}/account` : `${appUrl}/sign-in`;

          const emailService = createEmailService();
            emailService
              .sendSubscriptionConfirmationEmail({
                userName,
                userEmail,
                subscriptionId: payment.subscription,
                planName: profile?.subscriptionPlan || 'manager_base',
                value: payment.value,
                nextDueDate: payment.dueDate,
                manageUrl,
                timezone: profile?.timezone,
              })
            .then((res) => {
              if (res.success) {
                console.info('📧 [PaymentValidationService] Email de confirmação de assinatura enviado');
              } else {
                console.warn('📧 [PaymentValidationService] Falha ao enviar email de confirmação:', res.error);
              }
            })
            .catch((err) => {
              console.error('📧 [PaymentValidationService] Erro ao enviar email de confirmação:', err);
            });
        } else {
          console.warn('📧 [PaymentValidationService] Email do usuário não encontrado para envio de confirmação');
        }
      } catch (emailErr) {
        console.error('📧 [PaymentValidationService] Erro inesperado no fluxo de email:', emailErr);
      }

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
