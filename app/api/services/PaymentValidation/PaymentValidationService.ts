// app/api/services/PaymentValidation/PaymentValidationService.ts

import { IPaymentValidationService, PaymentValidationResult } from './IPaymentValidationService';
import { IPaymentRepository } from '../../infra/data/repositories/payment/IPaymentRepository';
import type { AsaasPayment, AsaasSubscription } from './AsaasWebhookTypes';
import { isAsaasPayment, isAsaasSubscription } from './AsaasWebhookTypes';
import { createEmailService } from '@/lib/services/EmailService';
import { asaasApi, asaasFetch } from '@/lib/asaas';
import { getAppUrl } from '@/lib/utils/app-url';
import {
  isAsaasRealSubscriptionEvent,
  PAST_DUE_INACTIVE_AFTER_DAYS,
  resolveLocalSubscriptionStatus,
} from '@/lib/billing/asaas-subscription-status';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscription/AsaasSubscriptionService';
import { billingEngineRepository } from '@/app/api/infra/data/repositories/billing/BillingEngineRepository';
import { logSubscriptionChange } from '@/lib/billing/logSubscriptionChange';
import { lifecycleEventFromSubscriptionStatus } from '@/lib/billing/lifecycleEventFromSubscriptionStatus';
import { getPaymentByAccountWithFallback } from '@/lib/billing/get-payment-by-account';

export class PaymentValidationService implements IPaymentValidationService {
  constructor(private paymentRepository: IPaymentRepository) {}

  async validatePayment(paymentId: string): Promise<PaymentValidationResult> {
    try {
      console.info(
        `[PaymentValidationService] Validando pagamento: ${paymentId}`
      );

      // Buscar informações do pagamento no Asaas — fallback de conta (C24
      // de [[20 — Assinaturas — Backend]] E5, sem contexto de perfil aqui).
      const lookup = await getPaymentByAccountWithFallback(paymentId);
      if (!lookup.found) {
        return {
          success: false,
          isPaid: false,
          message: 'Pagamento não encontrado',
        };
      }
      const payment = lookup.payment as {
        status: string;
        customer: string;
        subscription?: string;
      };
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

      // SUBSCRIPTION_* (sem payment): payload é subscription — só eventos reais Asaas (D5/C0)
      if (isAsaasRealSubscriptionEvent(event) && paymentData && isAsaasSubscription(paymentData as any)) {
        const sub = paymentData as AsaasSubscription;
        console.info('[PaymentValidationService] evento de assinatura recebido', {
          event,
          subscriptionId: sub.id,
          customerId: sub.customer,
          payloadStatus: sub.status,
          externalRef: sub.externalReference,
        });

        if (!sub.externalReference || !sub.id || !sub.customer) {
          return { success: true, isPaid: false, message: `${event} sem dados suficientes para vincular` };
        }

        let profile = await this.paymentRepository.findById(sub.externalReference);
        if (!profile) {
          profile = await this.paymentRepository.findByEmail(sub.externalReference);
        }
        if (!profile) {
          console.warn('[PaymentValidationService] Profile não encontrado no evento de assinatura');
          return { success: true, isPaid: false, message: `Profile não encontrado para ${event}` };
        }

        const mappedStatus = resolveLocalSubscriptionStatus({
          event,
          payloadStatus: sub.status,
        });

        if (!mappedStatus) {
          console.warn('[PaymentValidationService] status de assinatura não mapeado — sem alteração local', {
            event,
            payloadStatus: sub.status,
            profileId: profile.id,
          });
          return {
            success: true,
            isPaid: false,
            message: `Status Asaas não mapeado (${sub.status ?? 'undefined'}); conta não reativada`,
          };
        }

        const endDate = mappedStatus === 'canceled' ? new Date() : undefined;
        const startDate = mappedStatus === 'active' ? new Date() : undefined;
        const preservedPlan =
          profile.subscriptionPlan ??
          (profile.operatorCount && profile.operatorCount > 0 ? 'with_operators' : 'manager_base');

        const previousStatus = profile.subscriptionStatus;
        await this.paymentRepository.updateSubscriptionData(profile.id, {
          asaasCustomerId: sub.customer,
          subscriptionId: sub.id,
          subscriptionPlan: preservedPlan,
          subscriptionStatus: mappedStatus,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
        });

        const eventType = lifecycleEventFromSubscriptionStatus(previousStatus, mappedStatus);
        if (eventType) {
          await logSubscriptionChange({
            profileId: profile.id,
            source: 'PaymentValidationService.processWebhook.subscriptionEvent',
            changeType: eventType,
            eventType,
            before: { subscriptionStatus: previousStatus },
            after: { subscriptionStatus: mappedStatus },
            metadata: { event, asaasSubscriptionId: sub.id },
          });
        }

        console.info(`[PaymentValidationService] Profile vinculado no ${event}: ${profile.id} → ${mappedStatus}`);
        return { success: true, isPaid: false, paymentStatus: 'PENDING', profileUpdated: true, message: 'Assinatura vinculada ao Profile' };
      }

      if (
        ['SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_SUSPENDED', 'SUBSCRIPTION_CANCELED'].includes(event)
      ) {
        console.warn('[PaymentValidationService] evento de assinatura inventado ignorado', { event });
        return { success: true, isPaid: false, message: `Evento ${event} não é emitido pelo Asaas — ignorado` };
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
            // Avaliar limiar de past_due prolongado ANTES do update (updatedAt seria resetado).
            await this.maybeInactivateAsaasAfterProlongedPastDue(profile.id, payment.subscription);

            const previousStatus = profile.subscriptionStatus;
            await this.paymentRepository.updateSubscriptionData(profile.id, {
              subscriptionStatus: 'past_due',
            });
            const eventType = lifecycleEventFromSubscriptionStatus(previousStatus, 'past_due');
            if (eventType) {
              await logSubscriptionChange({
                profileId: profile.id,
                source: 'PaymentValidationService.processWebhook.PAYMENT_OVERDUE',
                changeType: eventType,
                eventType,
                before: { subscriptionStatus: previousStatus },
                after: { subscriptionStatus: 'past_due' },
              });
            }
            console.info(`[PaymentValidationService] Profile marcado como past_due por OVERDUE: ${profile.id}`);

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
        return {
          success: true,
          isPaid: false,
          paymentStatus: payment.status,
          message: 'Pagamento em atraso processado',
        };
      }

  // Refund / chargeback: suspende acesso; parcial NÃO força past_due (só log + suspended se total/chargeback)
  const refundOrChargebackEvents = [
    'PAYMENT_REFUNDED',
    'PAYMENT_PARTIALLY_REFUNDED',
    'PAYMENT_CHARGEBACK_REQUESTED',
    'PAYMENT_CHARGEBACK_DISPUTE',
    'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
    'PAYMENT_CHARGEBACK',
  ];
  if (refundOrChargebackEvents.includes(event) || ['REFUNDED', 'CHARGEBACK'].includes(String(payment.status).toUpperCase())) {
    try {
      let profile: Awaited<ReturnType<IPaymentRepository['findBySubscriptionId']>> = null;
      if (payment.subscription) {
        profile = await this.paymentRepository.findBySubscriptionId(payment.subscription);
      }
      if (!profile) {
        profile = await this.paymentRepository.findByAsaasCustomerId(payment.customer);
      }

      const isPartial = event === 'PAYMENT_PARTIALLY_REFUNDED';
      if (profile && !isPartial) {
        const previousStatus = profile.subscriptionStatus;
        await this.paymentRepository.updateSubscriptionData(profile.id, {
          subscriptionStatus: 'suspended',
        });
        const eventType = lifecycleEventFromSubscriptionStatus(previousStatus, 'suspended');
        if (eventType) {
          await logSubscriptionChange({
            profileId: profile.id,
            source: 'PaymentValidationService.processWebhook.refundOrChargeback',
            changeType: eventType,
            eventType,
            before: { subscriptionStatus: previousStatus },
            after: { subscriptionStatus: 'suspended' },
            metadata: { event, paymentId: payment.id },
          });
        }
        console.info('[PaymentValidationService] refund/chargeback → suspended', {
          event,
          profileId: profile.id,
          paymentId: payment.id,
        });
        return {
          success: true,
          isPaid: false,
          paymentStatus: payment.status,
          profileUpdated: true,
          message: `Evento ${event}: assinatura local suspensa`,
        };
      }

      console.info('[PaymentValidationService] refund parcial ou sem profile — sem past_due automático', {
        event,
        paymentId: payment.id,
        profileId: profile?.id,
      });
      return {
        success: true,
        isPaid: false,
        paymentStatus: payment.status,
        message: isPartial
          ? 'Estorno parcial registrado sem alteração automática de status'
          : `Evento ${event} processado`,
      };
    } catch (e) {
      console.error('[PaymentValidationService] Erro no handler refund/chargeback:', e);
      return {
        success: true,
        isPaid: false,
        paymentStatus: payment.status,
        message: `Evento ${event} recebido com erro interno (não reprocessar como active)`,
      };
    }
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

        const isAdhesionPayment =
          payment.externalReference?.startsWith("backoffice-adhesion-") ?? false
        const isPendingActionPayment =
          payment.externalReference?.startsWith("pending-action-") ?? false
        const shouldSendConfirmationEmail =
          event === "PAYMENT_CONFIRMED" || event === "PAYMENT_APPROVED"

        if (userEmail && shouldSendConfirmationEmail && !isAdhesionPayment && !isPendingActionPayment) {
          const userName = profile?.fullName || userEmail.split('@')[0];
          const appUrl = getAppUrl({ removeTrailingSlash: true });
          const manageUrl = profile?.supabaseId ? `${appUrl}/${profile.supabaseId}/account` : `${appUrl}/sign-in`;

          const emailService = createEmailService();
            emailService
              .sendSubscriptionConfirmationEmail({
                userName,
                userEmail,
                subscriptionId: payment.subscription,
                planName: profile?.subscriptionPlan || 'assinatura',
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

      // Atualizar dados — preservar plano existente (D3 / C3); derivar só se nulo
      const preservedPlan =
        profile.subscriptionPlan ??
        (profile.operatorCount && profile.operatorCount > 0 ? 'with_operators' : 'manager_base');
      const previousStatus = profile.subscriptionStatus;

      await this.paymentRepository.updateSubscriptionData(profile.id, {
        asaasCustomerId,
        subscriptionId,
        subscriptionPlan: preservedPlan,
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
      });

      // Timeline (20 — Assinaturas — Backend E1, C12): distingue contratação
      // (sem/trial) de renovação (já ativa) de reativação (vinha de
      // past_due/suspended/canceled) — nunca "restored" fixo para todo
      // PAYMENT_CONFIRMED.
      const eventType = lifecycleEventFromSubscriptionStatus(previousStatus, 'active');
      if (eventType) {
        await logSubscriptionChange({
          profileId: profile.id,
          source: 'PaymentValidationService.updateProfileStatus',
          changeType: eventType,
          eventType,
          before: { subscriptionStatus: previousStatus },
          after: { subscriptionStatus: 'active', subscriptionId, asaasCustomerId },
        });
      }

      console.info(
        `[PaymentValidationService] Profile atualizado: ${profile.id}`
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

  /**
   * Se a conta está past_due há >= PAST_DUE_INACTIVE_AFTER_DAYS, pede INACTIVE no Asaas.
   */
  private async maybeInactivateAsaasAfterProlongedPastDue(
    profileId: string,
    asaasSubscriptionId?: string
  ): Promise<void> {
    if (!asaasSubscriptionId) return;

    try {
      const row = await billingEngineRepository.findProfileSubscriptionForPastDue(profileId);

      const status = row?.subscriptionStatus ?? null;
      const subId = row?.asaasSubscriptionId ?? asaasSubscriptionId;
      if (!subId) return;

      const profile = await billingEngineRepository.findProfileBillingDates(profileId);

      const effectiveStatus = status ?? profile?.subscriptionStatus;
      const since = row?.updatedAt ?? profile?.updatedAt;
      if (effectiveStatus !== 'past_due' || !since) return;

      const ageMs = Date.now() - since.getTime();
      const thresholdMs = PAST_DUE_INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
      if (ageMs < thresholdMs) return;

      await AsaasSubscriptionService.updateSubscription(subId, {
        status: 'INACTIVE',
      });

      console.info('[PaymentValidationService] Asaas INACTIVE solicitado por past_due prolongado', {
        profileId,
        subscriptionId: subId,
        pastDueDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      });
    } catch (error) {
      console.error('[PaymentValidationService] falha ao inativar Asaas por past_due:', error);
    }
  }
}
